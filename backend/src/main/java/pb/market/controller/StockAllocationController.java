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

            // 1. Deduct from holding inventory (FIFO)
            List<StockBatch> holdingBatches = stockBatchRepository.findReceivableForHoldingForUpdate(item.getVariantId());

            int remaining = qty;
            for (StockBatch hBatch : holdingBatches) {
                if (remaining <= 0) break;
                int avail = hBatch.getRemainingQuantity() != null ? hBatch.getRemainingQuantity() : 0;
                if (avail >= remaining) {
                    hBatch.setRemainingQuantity(avail - remaining);
                    remaining = 0;
                } else {
                    hBatch.setRemainingQuantity(0);
                    remaining -= avail;
                }
                stockBatchRepository.save(hBatch);
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

        return m;
    }
}
