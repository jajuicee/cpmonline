package pb.market.controller;

import jakarta.transaction.Transactional;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import pb.market.config.StockWebSocketHandler;
import pb.market.config.UserPrincipal;
import pb.market.dto.StockAllocationRequest;
import pb.market.entity.*;
import pb.market.repository.*;
import pb.market.util.DateTimeUtil;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Handles admin → branch stock allocations.
 * Only ADMIN role can create allocations; both ADMIN and BRANCH can read them.
 */
@RestController
@RequestMapping({"/api/admin/allocations", "/api/allocations"})
public class StockAllocationController {

    private final BranchStockAllocationRepository allocationRepo;
    private final BranchRepository branchRepository;
    private final VariantRepository variantRepository;
    private final StockBatchRepository stockBatchRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final StockWebSocketHandler stockWebSocketHandler;
    private final BranchSellingPriceRepository branchSellingPriceRepository;

    public StockAllocationController(
            BranchStockAllocationRepository allocationRepo,
            BranchRepository branchRepository,
            VariantRepository variantRepository,
            StockBatchRepository stockBatchRepository,
            StockAdjustmentRepository stockAdjustmentRepository,
            StockWebSocketHandler stockWebSocketHandler,
            BranchSellingPriceRepository branchSellingPriceRepository) {
        this.allocationRepo = allocationRepo;
        this.branchRepository = branchRepository;
        this.variantRepository = variantRepository;
        this.stockBatchRepository = stockBatchRepository;
        this.stockAdjustmentRepository = stockAdjustmentRepository;
        this.stockWebSocketHandler = stockWebSocketHandler;
        this.branchSellingPriceRepository = branchSellingPriceRepository;
    }

    // ─── POST /api/admin/allocations ──────────────────────────────────────────
    // Admin creates a stock allocation: moves stock from Holding Pool → retail branch

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> createAllocation(@RequestBody StockAllocationRequest request) {
        if (request.getBranchId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "branchId is required."));
        }
        if (request.getDeadline() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Payment deadline is required."));
        }
        if (request.getItems() == null || request.getItems().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "At least one item is required."));
        }

        Branch targetBranch = branchRepository.findById(request.getBranchId()).orElse(null);
        if (targetBranch == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Branch not found: " + request.getBranchId()));
        }

        // --- Validate all variants & holding stock upfront ---
        for (StockAllocationRequest.AllocationItem item : request.getItems()) {
            if (!variantRepository.existsById(item.getVariantId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Variant not found: " + item.getVariantId()));
            }
            if (item.getQuantity() == null || item.getQuantity() <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Quantity must be > 0 for variant: " + item.getVariantId()));
            }
            if (item.getCostPerUnit() == null || item.getCostPerUnit().compareTo(BigDecimal.ZERO) < 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "costPerUnit must be >= 0 for variant: " + item.getVariantId()));
            }

            // Check holding pool inventory has enough stock
            long available = stockBatchRepository.sumRemainingQuantityForHolding(item.getVariantId());
            if (item.getQuantity() > available) {
                ProductVariant v = variantRepository.findById(item.getVariantId()).orElse(null);
                String name = (v != null && v.getProduct() != null)
                        ? v.getProduct().getBrandName() + " " + v.getProduct().getModelName() + " (" + v.getSku() + ")"
                        : "Variant #" + item.getVariantId();
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Insufficient holding stock for " + name + ". Available in holding pool: " + available + ", requested: " + item.getQuantity()
                ));
            }
        }

        String adminBatchId = UUID.randomUUID().toString();

        List<Map<String, Object>> created = new ArrayList<>();

        for (StockAllocationRequest.AllocationItem item : request.getItems()) {
            ProductVariant variant = variantRepository.findById(item.getVariantId()).get();
            int qty = item.getQuantity();
            BigDecimal costPerUnit = item.getCostPerUnit();
            BigDecimal totalCost = costPerUnit.multiply(BigDecimal.valueOf(qty));

            // 1. Deduct from holding inventory (FIFO) & capture admin acquisition cost
            List<StockBatch> holdingBatches = stockBatchRepository.findReceivableForHoldingForUpdate(item.getVariantId());

            int remaining = qty;
            BigDecimal totalAdminAcqCost = BigDecimal.ZERO;
            int totalDeductedUnits = 0;

            for (StockBatch hBatch : holdingBatches) {
                if (remaining <= 0) break;
                int avail = hBatch.getRemainingQuantity() != null ? hBatch.getRemainingQuantity() : 0;
                int deduct = Math.min(avail, remaining);
                BigDecimal batchCost = hBatch.getAcquisitionPrice() != null ? hBatch.getAcquisitionPrice()
                        : (variant.getAcquisitionPrice() != null ? variant.getAcquisitionPrice() : BigDecimal.ZERO);
                totalAdminAcqCost = totalAdminAcqCost.add(batchCost.multiply(BigDecimal.valueOf(deduct)));
                totalDeductedUnits += deduct;

                if (avail >= remaining) {
                    hBatch.setRemainingQuantity(avail - remaining);
                    remaining = 0;
                } else {
                    hBatch.setRemainingQuantity(0);
                    remaining -= avail;
                }
                stockBatchRepository.save(hBatch);
            }

            BigDecimal adminCostPerUnit;
            if (totalDeductedUnits > 0) {
                adminCostPerUnit = totalAdminAcqCost.divide(BigDecimal.valueOf(totalDeductedUnits), 2, java.math.RoundingMode.HALF_UP);
            } else {
                adminCostPerUnit = variant.getAcquisitionPrice() != null ? variant.getAcquisitionPrice() : BigDecimal.ZERO;
            }

            // 2. Record stock adjustment (from holding)
            StockAdjustment adj = new StockAdjustment();
            adj.setVariant(variant);
            adj.setQuantity(qty);
            adj.setReason("Allocated to Branch: " + targetBranch.getName());
            adj.setNote("Branch allocation batch: " + adminBatchId);
            adj.setBranch(null);
            stockAdjustmentRepository.save(adj);

            // 3. Create a new StockBatch at the target branch
            StockBatch branchBatch = new StockBatch();
            branchBatch.setVariant(variant);
            branchBatch.setQuantity(qty);
            branchBatch.setRemainingQuantity(qty);
            branchBatch.setAcquisitionPrice(costPerUnit);
            branchBatch.setStatus("RECEIVED");
            branchBatch.setBranch(targetBranch);
            branchBatch.setBatchId(adminBatchId);
            branchBatch.setConsigned(false);
            StockBatch savedBatch = stockBatchRepository.save(branchBatch);

            // 4. Create the BranchStockAllocation record
            BranchStockAllocation allocation = new BranchStockAllocation();
            allocation.setBranch(targetBranch);
            allocation.setVariant(variant);
            allocation.setQuantity(qty);
            allocation.setCostPerUnit(costPerUnit);
            allocation.setAdminCostPerUnit(adminCostPerUnit);
            allocation.setTotalCost(totalCost);
            allocation.setDeadline(request.getDeadline());
            allocation.setAmountPaid(BigDecimal.ZERO);
            allocation.setStatus("PENDING");
            allocation.setNotes(request.getNotes());
            allocation.setAdminBatchId(adminBatchId);
            allocation.setStockBatchId(savedBatch.getId());
            allocationRepo.save(allocation);

            // 5. Update branch retail selling price if provided
            if (item.getSellingPrice() != null && item.getSellingPrice().compareTo(BigDecimal.ZERO) >= 0) {
                BranchSellingPrice bsp = branchSellingPriceRepository
                        .findByBranchIdAndVariantId(targetBranch.getId(), variant.getId())
                        .orElseGet(() -> {
                            BranchSellingPrice newBsp = new BranchSellingPrice();
                            newBsp.setBranch(targetBranch);
                            newBsp.setVariant(variant);
                            return newBsp;
                        });
                bsp.setSellingPrice(item.getSellingPrice());
                branchSellingPriceRepository.save(bsp);
            }

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("variantId", variant.getId());
            entry.put("sku", variant.getSku());
            entry.put("quantity", qty);
            entry.put("costPerUnit", costPerUnit);
            if (item.getSellingPrice() != null) {
                entry.put("sellingPrice", item.getSellingPrice());
            }
            entry.put("totalCost", totalCost);
            created.add(entry);
        }

        stockWebSocketHandler.broadcastStockUpdate();

        return ResponseEntity.ok(Map.of(
                "message", "Stock allocated to " + targetBranch.getName() + " successfully.",
                "adminBatchId", adminBatchId,
                "itemCount", created.size(),
                "items", created
        ));
    }

    // ─── GET /api/admin/allocations ───────────────────────────────────────────
    // Admin: list all allocations optionally filtered by branch

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> listAllocations(@RequestParam(required = false) Long branchId) {
        List<BranchStockAllocation> list = (branchId != null)
                ? allocationRepo.findByBranchIdWithDetails(branchId)
                : allocationRepo.findAllWithDetails();

        List<Long> sbIds = list.stream()
                .map(BranchStockAllocation::getStockBatchId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, Integer> remainingQtyMap = new HashMap<>();
        if (!sbIds.isEmpty()) {
            stockBatchRepository.findAllById(sbIds).forEach(sb -> {
                remainingQtyMap.put(sb.getId(), sb.getRemainingQuantity() != null ? sb.getRemainingQuantity() : 0);
            });
        }

        return ResponseEntity.ok(list.stream().map(a -> toMap(a, remainingQtyMap)).toList());
    }

    // ─── GET /api/admin/allocations/summary ───────────────────────────────────
    // Admin: per-branch dues summary (outstanding balance, overdue count)

    @GetMapping("/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> allocationSummary() {
        LocalDate today = LocalDate.now();
        List<Object[]> outstandingRows = allocationRepo.sumOutstandingPerBranch();
        List<Object[]> overdueRows = allocationRepo.countOverdueByBranch(today);

        Map<Long, BigDecimal> outstandingByBranch = new HashMap<>();
        for (Object[] row : outstandingRows) {
            outstandingByBranch.put(((Number) row[0]).longValue(), (BigDecimal) row[1]);
        }
        Map<Long, Long> overdueByBranch = new HashMap<>();
        for (Object[] row : overdueRows) {
            overdueByBranch.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }

        List<Map<String, Object>> result = branchRepository.findAll().stream()
                .filter(b -> b.isActive() && (b.getName() == null || !b.getName().toLowerCase().contains("warehouse")))
                .map(b -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("branchId", b.getId());
            m.put("branchName", b.getName());
            m.put("outstanding", outstandingByBranch.getOrDefault(b.getId(), BigDecimal.ZERO));
            m.put("overdueCount", overdueByBranch.getOrDefault(b.getId(), 0L));
            return m;
        }).toList();

        return ResponseEntity.ok(result);
    }

    // ─── GET /api/admin/allocations/batch-profit ──────────────────────────────
    // Wholesale Batch Profit & P&L Analysis: Spread per unit (₱37.50 cost vs ₱40.00 branch price)
    @GetMapping({"/batch-profit", "/analytics/batch-profit"})
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getBatchProfitAnalytics(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String status) {

        List<BranchStockAllocation> list = (branchId != null)
                ? allocationRepo.findByBranchIdWithDetails(branchId)
                : allocationRepo.findAllWithDetails();

        // Optional date filtering on allocatedAt
        LocalDateTime fromDt = DateTimeUtil.parseStart(from);
        LocalDateTime toDt   = DateTimeUtil.parseEnd(to);

        if (fromDt != null || toDt != null || (status != null && !status.equalsIgnoreCase("ALL"))) {
            list = list.stream().filter(a -> {
                if (status != null && !status.equalsIgnoreCase("ALL") && !status.equalsIgnoreCase(a.getStatus())) {
                    return false;
                }
                if (a.getAllocatedAt() == null) return true;
                if (fromDt != null && a.getAllocatedAt().isBefore(fromDt)) return false;
                if (toDt != null && a.getAllocatedAt().isAfter(toDt)) return false;
                return true;
            }).toList();
        }

        List<Long> sbIds = list.stream()
                .map(BranchStockAllocation::getStockBatchId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, Integer> remainingQtyMap = new HashMap<>();
        if (!sbIds.isEmpty()) {
            stockBatchRepository.findAllById(sbIds).forEach(sb -> {
                remainingQtyMap.put(sb.getId(), sb.getRemainingQuantity() != null ? sb.getRemainingQuantity() : 0);
            });
        }

        List<Map<String, Object>> batchRows = list.stream().map(a -> toMap(a, remainingQtyMap)).toList();

        // Summary Aggregates
        int totalAllocatedUnits = 0;
        BigDecimal totalBilledRevenue = BigDecimal.ZERO;
        BigDecimal totalAdminCost = BigDecimal.ZERO;
        BigDecimal totalAmountPaid = BigDecimal.ZERO;
        BigDecimal totalOutstanding = BigDecimal.ZERO;
        int paidCount = 0;
        int partialCount = 0;
        int pendingCount = 0;

        Map<Long, Map<String, Object>> branchAgg = new LinkedHashMap<>();
        Map<String, Map<String, Object>> timelineAgg = new TreeMap<>();

        for (Map<String, Object> row : batchRows) {
            int q = ((Number) row.getOrDefault("quantity", 0)).intValue();
            BigDecimal billed = (BigDecimal) row.getOrDefault("totalCost", BigDecimal.ZERO);
            BigDecimal adminC = (BigDecimal) row.getOrDefault("totalAdminCost", BigDecimal.ZERO);
            BigDecimal paid = (BigDecimal) row.getOrDefault("amountPaid", BigDecimal.ZERO);
            BigDecimal bal = (BigDecimal) row.getOrDefault("remainingBalance", BigDecimal.ZERO);
            String st = String.valueOf(row.getOrDefault("status", "PENDING"));

            totalAllocatedUnits += q;
            totalBilledRevenue = totalBilledRevenue.add(billed != null ? billed : BigDecimal.ZERO);
            totalAdminCost = totalAdminCost.add(adminC != null ? adminC : BigDecimal.ZERO);
            totalAmountPaid = totalAmountPaid.add(paid != null ? paid : BigDecimal.ZERO);
            totalOutstanding = totalOutstanding.add(bal != null ? bal : BigDecimal.ZERO);

            if ("PAID".equalsIgnoreCase(st)) paidCount++;
            else if ("PARTIAL".equalsIgnoreCase(st)) partialCount++;
            else pendingCount++;

            // Branch Breakdown
            Long bId = (Long) row.get("branchId");
            if (bId != null) {
                Map<String, Object> bm = branchAgg.computeIfAbsent(bId, k -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("branchId", bId);
                    m.put("branchName", row.get("branchName"));
                    m.put("units", 0);
                    m.put("billedRevenue", BigDecimal.ZERO);
                    m.put("adminCost", BigDecimal.ZERO);
                    m.put("grossProfit", BigDecimal.ZERO);
                    m.put("amountPaid", BigDecimal.ZERO);
                    m.put("outstanding", BigDecimal.ZERO);
                    return m;
                });
                bm.put("units", ((int) bm.get("units")) + q);
                bm.put("billedRevenue", ((BigDecimal) bm.get("billedRevenue")).add(billed != null ? billed : BigDecimal.ZERO));
                bm.put("adminCost", ((BigDecimal) bm.get("adminCost")).add(adminC != null ? adminC : BigDecimal.ZERO));
                bm.put("amountPaid", ((BigDecimal) bm.get("amountPaid")).add(paid != null ? paid : BigDecimal.ZERO));
                bm.put("outstanding", ((BigDecimal) bm.get("outstanding")).add(bal != null ? bal : BigDecimal.ZERO));
            }

            // Timeline (by date string YYYY-MM-DD)
            String allocAt = (String) row.get("allocatedAt");
            String dateKey = (allocAt != null && allocAt.length() >= 10) ? allocAt.substring(0, 10) : "Undated";
            Map<String, Object> tm = timelineAgg.computeIfAbsent(dateKey, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("date", dateKey);
                m.put("units", 0);
                m.put("billedRevenue", BigDecimal.ZERO);
                m.put("adminCost", BigDecimal.ZERO);
                m.put("grossProfit", BigDecimal.ZERO);
                return m;
            });
            tm.put("units", ((int) tm.get("units")) + q);
            tm.put("billedRevenue", ((BigDecimal) tm.get("billedRevenue")).add(billed != null ? billed : BigDecimal.ZERO));
            tm.put("adminCost", ((BigDecimal) tm.get("adminCost")).add(adminC != null ? adminC : BigDecimal.ZERO));
        }

        BigDecimal totalGrossProfit = totalBilledRevenue.subtract(totalAdminCost);
        BigDecimal averageMarginPct = totalBilledRevenue.compareTo(BigDecimal.ZERO) > 0
                ? totalGrossProfit.divide(totalBilledRevenue, 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        // Finalize branch summaries
        for (Map<String, Object> bm : branchAgg.values()) {
            BigDecimal bBilled = (BigDecimal) bm.get("billedRevenue");
            BigDecimal bCost = (BigDecimal) bm.get("adminCost");
            BigDecimal bProfit = bBilled.subtract(bCost);
            bm.put("grossProfit", bProfit);
            bm.put("marginPct", bBilled.compareTo(BigDecimal.ZERO) > 0
                    ? bProfit.divide(bBilled, 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                    : BigDecimal.ZERO);
        }

        // Finalize timeline
        for (Map<String, Object> tm : timelineAgg.values()) {
            BigDecimal tBilled = (BigDecimal) tm.get("billedRevenue");
            BigDecimal tCost = (BigDecimal) tm.get("adminCost");
            tm.put("grossProfit", tBilled.subtract(tCost));
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalAllocatedUnits", totalAllocatedUnits);
        summary.put("totalBilledRevenue", totalBilledRevenue);
        summary.put("totalAdminCost", totalAdminCost);
        summary.put("totalGrossProfit", totalGrossProfit);
        summary.put("averageMarginPct", averageMarginPct);
        summary.put("totalAmountPaid", totalAmountPaid);
        summary.put("totalOutstanding", totalOutstanding);
        summary.put("totalBatchesCount", batchRows.size());
        summary.put("paidCount", paidCount);
        summary.put("partialCount", partialCount);
        summary.put("pendingCount", pendingCount);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("summary", summary);
        response.put("branchesBreakdown", new ArrayList<>(branchAgg.values()));
        response.put("timeline", new ArrayList<>(timelineAgg.values()));
        response.put("batches", batchRows);

        return ResponseEntity.ok(response);
    }


    // ─── GET /api/admin/allocations/branch-dues ───────────────────────────────
    // Branch user: see their own allocations / dues (fast eager-fetch, 0 N+1 queries)

    @GetMapping({"/branch-dues", "/my-dues"})
    public ResponseEntity<?> branchDues(
            @RequestParam(required = false) Long branchId,
            @AuthenticationPrincipal UserPrincipal user) {

        Long effectiveBranchId = (user != null && "BRANCH".equals(user.getRole()))
                ? user.getBranchId()
                : (branchId != null ? branchId : (user != null && user.getBranchId() != null ? user.getBranchId() : null));

        if (effectiveBranchId == null) {
            effectiveBranchId = branchRepository.findAll().stream().findFirst().map(Branch::getId).orElse(null);
        }

        if (effectiveBranchId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "No branch associated with this user."));
        }

        LocalDate today = LocalDate.now();
        LocalDate cutoff = today.plusDays(7);

        // 1 single query eager-fetching variant, product, and branch
        List<BranchStockAllocation> all = allocationRepo.findByBranchIdWithDetails(effectiveBranchId);

        // 1 batch query for remaining quantities
        List<Long> sbIds = all.stream()
                .map(BranchStockAllocation::getStockBatchId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, Integer> remainingQtyMap = new HashMap<>();
        if (!sbIds.isEmpty()) {
            stockBatchRepository.findAllById(sbIds).forEach(sb -> {
                remainingQtyMap.put(sb.getId(), sb.getRemainingQuantity() != null ? sb.getRemainingQuantity() : 0);
            });
        }

        BigDecimal totalOutstanding = BigDecimal.ZERO;
        int overdueCount = 0;
        int upcomingCount = 0;

        for (BranchStockAllocation a : all) {
            BigDecimal cost = a.getTotalCost() != null ? a.getTotalCost() : BigDecimal.ZERO;
            BigDecimal paid = a.getAmountPaid() != null ? a.getAmountPaid() : BigDecimal.ZERO;
            BigDecimal rem = cost.subtract(paid);

            if (!"PAID".equalsIgnoreCase(a.getStatus()) && rem.compareTo(BigDecimal.ZERO) > 0) {
                totalOutstanding = totalOutstanding.add(rem);
                if (a.getDeadline() != null) {
                    if (a.getDeadline().isBefore(today)) {
                        overdueCount++;
                    } else if (!a.getDeadline().isAfter(cutoff)) {
                        upcomingCount++;
                    }
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalOutstanding", totalOutstanding);
        result.put("overdueCount", overdueCount);
        result.put("upcomingCount", upcomingCount);
        result.put("allocations", all.stream().map(a -> toMap(a, remainingQtyMap)).toList());

        return ResponseEntity.ok(result);
    }

    // ─── PUT /api/admin/allocations/{id}/payment ──────────────────────────────
    // Admin records a payment from a branch toward a specific allocation

    @PutMapping("/{id}/payment")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> recordPayment(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        BranchStockAllocation allocation = allocationRepo.findById(id).orElse(null);
        if (allocation == null) {
            return ResponseEntity.notFound().build();
        }

        BigDecimal amount;
        try {
            amount = new BigDecimal(body.get("amount").toString());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid payment amount."));
        }

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Payment amount must be positive."));
        }

        BigDecimal remaining = allocation.getTotalCost().subtract(allocation.getAmountPaid());
        if (amount.compareTo(remaining) > 0) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Payment ₱" + amount + " exceeds remaining balance of ₱" + remaining));
        }

        BigDecimal newPaid = allocation.getAmountPaid().add(amount);
        allocation.setAmountPaid(newPaid);

        if (newPaid.compareTo(allocation.getTotalCost()) >= 0) {
            allocation.setStatus("PAID");
        } else if (newPaid.compareTo(BigDecimal.ZERO) > 0) {
            allocation.setStatus("PARTIAL");
        }

        allocationRepo.save(allocation);

        return ResponseEntity.ok(Map.of(
                "message", "Payment recorded successfully.",
                "allocationId", id,
                "amountPaid", newPaid,
                "status", allocation.getStatus(),
                "remainingBalance", allocation.getTotalCost().subtract(newPaid)
        ));
    }

    // ─── PUT /api/admin/allocations/batch/{batchId}/payment ───────────────────
    // Admin records a payment toward an entire batch, auto-applying across unpaid items

    @PutMapping("/batch/{batchId}/payment")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> recordBatchPayment(
            @PathVariable String batchId,
            @RequestBody Map<String, Object> body) {

        List<BranchStockAllocation> list = allocationRepo.findByAdminBatchId(batchId);
        if (list.isEmpty()) {
            try {
                Long singleId = Long.parseLong(batchId.replace("batch_", ""));
                BranchStockAllocation single = allocationRepo.findById(singleId).orElse(null);
                if (single != null) list = List.of(single);
            } catch (Exception ignored) {}
        }

        if (list.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        BigDecimal amount;
        try {
            amount = new BigDecimal(body.get("amount").toString());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid payment amount."));
        }

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Payment amount must be positive."));
        }

        BigDecimal totalRemaining = BigDecimal.ZERO;
        for (BranchStockAllocation a : list) {
            BigDecimal cost = a.getTotalCost() != null ? a.getTotalCost() : BigDecimal.ZERO;
            BigDecimal paid = a.getAmountPaid() != null ? a.getAmountPaid() : BigDecimal.ZERO;
            BigDecimal rem = cost.subtract(paid);
            if (rem.compareTo(BigDecimal.ZERO) > 0) {
                totalRemaining = totalRemaining.add(rem);
            }
        }

        if (amount.compareTo(totalRemaining) > 0) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Payment ₱" + amount + " exceeds batch balance of ₱" + totalRemaining));
        }

        BigDecimal remainingToApply = amount;
        for (BranchStockAllocation a : list) {
            if (remainingToApply.compareTo(BigDecimal.ZERO) <= 0) break;

            BigDecimal cost = a.getTotalCost() != null ? a.getTotalCost() : BigDecimal.ZERO;
            BigDecimal paid = a.getAmountPaid() != null ? a.getAmountPaid() : BigDecimal.ZERO;
            BigDecimal itemRemaining = cost.subtract(paid);
            if (itemRemaining.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal toApply = remainingToApply.min(itemRemaining);
            BigDecimal newPaid = paid.add(toApply);
            a.setAmountPaid(newPaid);

            if (newPaid.compareTo(cost) >= 0) {
                a.setStatus("PAID");
            } else if (newPaid.compareTo(BigDecimal.ZERO) > 0) {
                a.setStatus("PARTIAL");
            }

            allocationRepo.save(a);
            remainingToApply = remainingToApply.subtract(toApply);
        }

        return ResponseEntity.ok(Map.of(
                "message", "Payment of ₱" + amount + " recorded for batch " + batchId,
                "batchId", batchId,
                "amountPaid", amount,
                "remainingBatchBalance", totalRemaining.subtract(amount)
        ));
    }

    // ─── POST /api/allocations/pull-out or /api/admin/allocations/pull-out ────
    // Pull out stock from a branch and return it to the Master Admin (Holding Pool).
    @PostMapping("/pull-out")
    @Transactional
    public ResponseEntity<?> pullOutStock(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal user) {

        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Request body is required."));
        }

        Long branchId = null;
        if (body.get("branchId") != null) {
            try {
                branchId = Long.parseLong(body.get("branchId").toString());
            } catch (Exception ignored) {}
        }

        if (user != null && "BRANCH".equals(user.getRole())) {
            // Branch manager can only pull out from their own branch
            branchId = user.getBranchId();
        }

        if (branchId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "branchId is required."));
        }

        Branch branch = branchRepository.findById(branchId).orElse(null);
        if (branch == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Branch not found with id: " + branchId));
        }

        Long variantId = null;
        if (body.get("variantId") != null) {
            try {
                variantId = Long.parseLong(body.get("variantId").toString());
            } catch (Exception ignored) {}
        }
        if (variantId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "variantId is required."));
        }

        ProductVariant variant = variantRepository.findById(variantId).orElse(null);
        if (variant == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Product variant not found with id: " + variantId));
        }

        int quantity = 0;
        if (body.get("quantity") != null) {
            try {
                quantity = Integer.parseInt(body.get("quantity").toString());
            } catch (Exception ignored) {}
        }
        if (quantity <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Quantity must be greater than zero."));
        }

        String reason = body.get("reason") != null ? body.get("reason").toString().trim() : "Pulled out to Master Admin";
        String notes = body.get("notes") != null ? body.get("notes").toString().trim() : "";

        // 1. Fetch branch receivable batches for this variant with pessimistic write lock
        List<StockBatch> branchBatches = stockBatchRepository.findReceivableByVariantIdAndBranchIdForUpdate(variantId, branchId);
        int availableAtBranch = branchBatches.stream()
                .mapToInt(b -> b.getRemainingQuantity() != null ? b.getRemainingQuantity() : 0)
                .sum();

        if (quantity > availableAtBranch) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Cannot pull out " + quantity + " units. Only " + availableAtBranch + " units available at " + branch.getName() + "."));
        }

        int remainingToPull = quantity;
        BigDecimal totalPulledAcqCost = BigDecimal.ZERO;
        int unitsCounted = 0;
        boolean isPartner = false;
        String partnerName = null;
        BigDecimal partnerSplitPct = null;
        Supplier defaultOrBatchSupplier = variant.getDefaultSupplier();

        // 2. FIFO deduction across branch batches & credit associated allocations
        Set<Long> adjustedAllocIds = new HashSet<>();
        int creditedUnits = 0;

        for (StockBatch bBatch : branchBatches) {
            if (remainingToPull <= 0) break;
            int avail = bBatch.getRemainingQuantity() != null ? bBatch.getRemainingQuantity() : 0;
            if (avail <= 0) continue;

            int deduct = Math.min(avail, remainingToPull);
            bBatch.setRemainingQuantity(avail - deduct);
            stockBatchRepository.save(bBatch);

            BigDecimal acq = bBatch.getAcquisitionPrice() != null ? bBatch.getAcquisitionPrice()
                    : (variant.getAcquisitionPrice() != null ? variant.getAcquisitionPrice() : BigDecimal.ZERO);
            totalPulledAcqCost = totalPulledAcqCost.add(acq.multiply(BigDecimal.valueOf(deduct)));
            unitsCounted += deduct;

            if (bBatch.isPartner()) {
                isPartner = true;
                if (partnerName == null && bBatch.getPartnerName() != null) partnerName = bBatch.getPartnerName();
                if (partnerSplitPct == null && bBatch.getPartnerSplitPct() != null) partnerSplitPct = bBatch.getPartnerSplitPct();
            }
            if (bBatch.getSupplier() != null) {
                defaultOrBatchSupplier = bBatch.getSupplier();
            }

            // Adjust linked BranchStockAllocation if present
            if (bBatch.getId() != null) {
                List<BranchStockAllocation> linkedAllocs = allocationRepo.findByStockBatchId(bBatch.getId());
                for (BranchStockAllocation alloc : linkedAllocs) {
                    adjustAllocationForPullOut(alloc, deduct);
                    adjustedAllocIds.add(alloc.getId());
                    creditedUnits += deduct;
                }
            }

            remainingToPull -= deduct;
        }

        // If any pulled units were not credited via direct stockBatchId link (e.g. legacy allocations),
        // apply remaining pull credits across other unpaid allocations for this variant.
        int uncreditedPull = quantity - creditedUnits;
        if (uncreditedPull > 0) {
            List<BranchStockAllocation> variantAllocs = allocationRepo.findByBranchIdAndVariantId(branchId, variantId);
            for (BranchStockAllocation alloc : variantAllocs) {
                if (uncreditedPull <= 0) break;
                if (adjustedAllocIds.contains(alloc.getId())) continue;
                if (!"PAID".equals(alloc.getStatus()) && alloc.getQuantity() != null && alloc.getQuantity() > 0) {
                    int deductFromAlloc = Math.min(uncreditedPull, alloc.getQuantity());
                    adjustAllocationForPullOut(alloc, deductFromAlloc);
                    adjustedAllocIds.add(alloc.getId());
                    uncreditedPull -= deductFromAlloc;
                }
            }
        }

        // 3. Create or replenish Master Admin Holding StockBatch (branch == null)
        BigDecimal adminAcqPrice = (unitsCounted > 0)
                ? totalPulledAcqCost.divide(BigDecimal.valueOf(unitsCounted), 2, java.math.RoundingMode.HALF_UP)
                : (variant.getAcquisitionPrice() != null ? variant.getAcquisitionPrice() : BigDecimal.ZERO);

        StockBatch holdingBatch = new StockBatch();
        holdingBatch.setVariant(variant);
        holdingBatch.setQuantity(quantity);
        holdingBatch.setRemainingQuantity(quantity);
        holdingBatch.setAcquisitionPrice(adminAcqPrice);
        holdingBatch.setSupplier(defaultOrBatchSupplier);
        holdingBatch.setBranch(null); // Return to Master Admin holding pool
        holdingBatch.setStatus("RECEIVED");
        holdingBatch.setConsigned(false);
        holdingBatch.setPartner(isPartner);
        holdingBatch.setPartnerName(partnerName);
        holdingBatch.setPartnerSplitPct(partnerSplitPct);
        holdingBatch.setBatchId("PULLOUT-" + branch.getName().toUpperCase().replaceAll("[^A-Z0-9]+", "-") + "-" + System.currentTimeMillis());
        stockBatchRepository.save(holdingBatch);

        // 4. Record stock adjustments for audit trail
        // At branch
        StockAdjustment branchAdj = new StockAdjustment();
        branchAdj.setVariant(variant);
        branchAdj.setQuantity(quantity);
        branchAdj.setReason("Pulled out to Master Admin");
        branchAdj.setNote(notes.isBlank() ? "Returned to Master Admin Holding Pool" : notes);
        branchAdj.setBranch(branch);
        stockAdjustmentRepository.save(branchAdj);

        // At Master Admin Holding
        StockAdjustment hqAdj = new StockAdjustment();
        hqAdj.setVariant(variant);
        hqAdj.setQuantity(quantity);
        hqAdj.setReason("Pull-out from " + branch.getName());
        hqAdj.setNote("Stock returned from " + branch.getName() + (notes.isBlank() ? "" : ": " + notes));
        hqAdj.setBranch(null);
        stockAdjustmentRepository.save(hqAdj);

        // 5. Broadcast live stock change via WebSocket
        stockWebSocketHandler.broadcastStockUpdate();

        int newBranchRemaining = availableAtBranch - quantity;
        Long masterHoldingRemaining = stockBatchRepository.sumRemainingQuantityForHolding(variantId);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Successfully pulled out " + quantity + " unit(s) of " + (variant.getProduct() != null ? variant.getProduct().getModelName() : variant.getSku()) + " from " + branch.getName() + " back to Master Admin.",
                "branchId", branch.getId(),
                "branchName", branch.getName(),
                "variantId", variant.getId(),
                "sku", variant.getSku(),
                "pulledQuantity", quantity,
                "branchRemaining", newBranchRemaining,
                "masterHoldingRemaining", masterHoldingRemaining != null ? masterHoldingRemaining : quantity
        ));
    }

    private void adjustAllocationForPullOut(BranchStockAllocation alloc, int unitsDeducted) {
        if (alloc == null || unitsDeducted <= 0) return;
        int currentQty = alloc.getQuantity() != null ? alloc.getQuantity() : 0;
        int newQty = Math.max(0, currentQty - unitsDeducted);
        alloc.setQuantity(newQty);

        BigDecimal costPerUnit = alloc.getCostPerUnit() != null ? alloc.getCostPerUnit() : BigDecimal.ZERO;
        BigDecimal newTotalCost = costPerUnit.multiply(BigDecimal.valueOf(newQty));
        alloc.setTotalCost(newTotalCost);

        BigDecimal paid = alloc.getAmountPaid() != null ? alloc.getAmountPaid() : BigDecimal.ZERO;
        if (paid.compareTo(newTotalCost) >= 0) {
            alloc.setStatus("PAID");
        } else if (paid.compareTo(BigDecimal.ZERO) > 0) {
            alloc.setStatus("PARTIAL");
        } else {
            alloc.setStatus(newQty == 0 ? "PAID" : "PENDING");
        }
        allocationRepo.save(alloc);
    }

    // ─── Helper: serialize allocation to map ──────────────────────────────────

    private Map<String, Object> toMap(BranchStockAllocation a) {
        return toMap(a, null);
    }

    private Map<String, Object> toMap(BranchStockAllocation a, Map<Long, Integer> remainingQtyMap) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("branchId", a.getBranch() != null ? a.getBranch().getId() : null);
        m.put("branchName", a.getBranch() != null ? a.getBranch().getName() : null);

        if (a.getVariant() != null) {
            Map<String, Object> variant = new LinkedHashMap<>();
            variant.put("id", a.getVariant().getId());
            variant.put("sku", a.getVariant().getSku());
            variant.put("color", a.getVariant().getColor());
            variant.put("thicknessMm", a.getVariant().getThicknessMm());
            variant.put("shape", a.getVariant().getShape());
            m.put("variantId", a.getVariant().getId());
            m.put("sku", a.getVariant().getSku());

            if (a.getVariant().getProduct() != null) {
                variant.put("brandName", a.getVariant().getProduct().getBrandName());
                variant.put("modelName", a.getVariant().getProduct().getModelName());
                variant.put("category", a.getVariant().getProduct().getCategory());
                m.put("brandName", a.getVariant().getProduct().getBrandName());
                m.put("modelName", a.getVariant().getProduct().getModelName());
                m.put("category", a.getVariant().getProduct().getCategory());
            }
            m.put("variant", variant);
        }

        m.put("quantity", a.getQuantity());
        m.put("costPerUnit", a.getCostPerUnit());
        m.put("totalCost", a.getTotalCost());
        m.put("deadline", a.getDeadline() != null ? a.getDeadline().toString() : null);
        m.put("amountPaid", a.getAmountPaid());
        m.put("remainingBalance", a.getTotalCost() != null && a.getAmountPaid() != null
                ? a.getTotalCost().subtract(a.getAmountPaid()) : null);
        m.put("status", a.getStatus());
        m.put("notes", a.getNotes());
        m.put("adminBatchId", a.getAdminBatchId());
        m.put("stockBatchId", a.getStockBatchId());
        m.put("allocatedAt", a.getAllocatedAt() != null ? a.getAllocatedAt().toString() : null);

        // Live item tracking at the destination branch - fast memory lookup
        int remainingUnits = 0;
        if (remainingQtyMap != null && a.getStockBatchId() != null) {
            remainingUnits = remainingQtyMap.getOrDefault(a.getStockBatchId(), 0);
        } else if (a.getStockBatchId() != null) {
            StockBatch sb = stockBatchRepository.findById(a.getStockBatchId()).orElse(null);
            remainingUnits = (sb != null && sb.getRemainingQuantity() != null) ? sb.getRemainingQuantity() : 0;
        }

        int totalUnits = a.getQuantity() != null ? a.getQuantity() : 0;
        int soldUnits = Math.max(0, totalUnits - remainingUnits);
        m.put("remainingQuantity", remainingUnits);
        m.put("soldQuantity", soldUnits);
        m.put("isAllSold", remainingUnits <= 0 && totalUnits > 0);
        m.put("stockStatus", remainingUnits <= 0 ? "ALL_SOLD" : (soldUnits > 0 ? "PARTIALLY_SOLD" : "IN_STOCK"));

        // Flag overdue status
        if (a.getDeadline() != null && !"PAID".equals(a.getStatus())) {
            m.put("overdue", a.getDeadline().isBefore(LocalDate.now()));
        } else {
            m.put("overdue", false);
        }

        // Admin acquisition cost & wholesale margin spread
        BigDecimal adminCost = a.getAdminCostPerUnit();
        if (adminCost == null && a.getVariant() != null && a.getVariant().getAcquisitionPrice() != null) {
            adminCost = a.getVariant().getAcquisitionPrice();
        }
        if (adminCost == null) adminCost = BigDecimal.ZERO;

        BigDecimal costPerUnit = a.getCostPerUnit() != null ? a.getCostPerUnit() : BigDecimal.ZERO;
        BigDecimal unitSpread = costPerUnit.subtract(adminCost);
        BigDecimal totalCostVal = a.getTotalCost() != null ? a.getTotalCost() : costPerUnit.multiply(BigDecimal.valueOf(totalUnits));
        BigDecimal totalAdminCost = adminCost.multiply(BigDecimal.valueOf(totalUnits));
        BigDecimal totalBatchProfit = totalCostVal.subtract(totalAdminCost);
        BigDecimal profitMarginPct = totalCostVal.compareTo(BigDecimal.ZERO) > 0
                ? totalBatchProfit.divide(totalCostVal, 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        m.put("adminCostPerUnit", adminCost);
        m.put("unitSpread", unitSpread);
        m.put("totalAdminCost", totalAdminCost);
        m.put("totalBatchProfit", totalBatchProfit);
        m.put("profitMarginPct", profitMarginPct);

        return m;
    }
}
