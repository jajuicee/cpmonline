package pb.market.controller;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import pb.market.config.StockWebSocketHandler;
import pb.market.config.UserPrincipal;
import pb.market.dto.ApproveStockRequestDTO;
import pb.market.dto.BranchCatalogVariantDTO;
import pb.market.dto.CreateStockRequestDTO;
import pb.market.entity.*;
import pb.market.repository.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/stock-requests")
@RequiredArgsConstructor
@CrossOrigin
@org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'BRANCH')")
public class StockRequestController {

    private final StockRequestRepository stockRequestRepository;
    private final StockRequestItemRepository stockRequestItemRepository;
    private final BranchRepository branchRepository;
    private final VariantRepository variantRepository;
    private final StockBatchRepository stockBatchRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final BranchStockAllocationRepository allocationRepo;
    private final BranchSellingPriceRepository branchSellingPriceRepository;
    private final StockWebSocketHandler stockWebSocketHandler;

    // ── 1. GET /api/stock-requests/catalog (Branch-Safe Catalog, NO Cost Prices) ──
    @GetMapping("/catalog")
    public List<BranchCatalogVariantDTO> getCatalogForBranch(
            @RequestParam(required = false) Long branchId,
            @AuthenticationPrincipal UserPrincipal user) {

        Long effectiveBranchId = (user != null && "BRANCH".equals(user.getRole()))
                ? user.getBranchId()
                : branchId;

        // Map branch stock per variant if branchId is available
        Map<Long, Long> branchStockMap = new HashMap<>();
        if (effectiveBranchId != null) {
            stockBatchRepository.sumRemainingQuantityByVariantIdAndBranch(effectiveBranchId).forEach(row -> {
                Long vId = ((Number) row[0]).longValue();
                Long qty = ((Number) row[1]).longValue();
                branchStockMap.put(vId, qty);
            });
        }

        // Holding pool stock (Master Storage: branch is NULL)
        Map<Long, Long> holdingStockMap = new HashMap<>();
        stockBatchRepository.findAll().stream()
                .filter(b -> b.getBranch() == null && "RECEIVED".equals(b.getStatus()) && b.getRemainingQuantity() != null && b.getRemainingQuantity() > 0)
                .forEach(b -> {
                    if (b.getVariant() != null) {
                        holdingStockMap.merge(b.getVariant().getId(), (long) b.getRemainingQuantity(), Long::sum);
                    }
                });

        List<BranchCatalogVariantDTO> catalog = new ArrayList<>();
        List<ProductVariant> variants = variantRepository.findAll();

        for (ProductVariant v : variants) {
            long masterStock = holdingStockMap.getOrDefault(v.getId(), 0L);
            long bStock = branchStockMap.getOrDefault(v.getId(), 0L);

            Product p = v.getProduct();
            catalog.add(BranchCatalogVariantDTO.builder()
                    .variantId(v.getId())
                    .productId(p != null ? p.getId() : null)
                    .brandName(p != null ? p.getBrandName() : "")
                    .modelName(p != null ? p.getModelName() : "")
                    .category(p != null ? p.getCategory() : "General")
                    .sku(v.getSku())
                    .color(v.getColor())
                    .shape(v.getShape())
                    .thicknessMm(v.getThicknessMm())
                    .sellingPrice(v.getSellingPrice())
                    .masterStock(masterStock)
                    .branchStock(bStock)
                    .build());
        }

        // Sort: items with master stock first, then alphabetically
        catalog.sort(Comparator.comparing((BranchCatalogVariantDTO c) -> c.getMasterStock() > 0 ? 0 : 1)
                .thenComparing(c -> c.getBrandName() + " " + c.getModelName()));

        return catalog;
    }

    // ── 2. POST /api/stock-requests (Branch Submits Request) ─────────────────────
    @PostMapping
    @Transactional
    public ResponseEntity<?> createRequest(
            @RequestBody CreateStockRequestDTO dto,
            @AuthenticationPrincipal UserPrincipal user) {

        Long branchId = (user != null && "BRANCH".equals(user.getRole()))
                ? user.getBranchId()
                : dto.getBranchId();

        if (branchId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Branch ID is required."));
        }

        Branch branch = branchRepository.findById(branchId).orElse(null);
        if (branch == null || !branch.isActive()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Active branch not found."));
        }

        if (dto.getItems() == null || dto.getItems().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "At least one item is required in the request."));
        }

        // Validate items and holding availability
        for (CreateStockRequestDTO.Item item : dto.getItems()) {
            if (item.getVariantId() == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Variant ID is required for each item."));
            }
            if (item.getQuantity() == null || item.getQuantity() <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Requested quantity must be greater than 0."));
            }
            ProductVariant variant = variantRepository.findById(item.getVariantId()).orElse(null);
            if (variant == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Variant #" + item.getVariantId() + " not found."));
            }
            long available = stockBatchRepository.sumRemainingQuantityForHolding(variant.getId());
            if (item.getQuantity() > available) {
                String name = (variant.getProduct() != null)
                        ? variant.getProduct().getBrandName() + " " + variant.getProduct().getModelName() + " (" + variant.getSku() + ")"
                        : "Variant #" + variant.getId();
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Requested quantity for " + name + " (" + item.getQuantity() + ") exceeds available Master Storage stock (" + available + ")."
                ));
            }
        }

        // Generate sequential human-readable request number
        String datePrefix = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randomSuffix = UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        String reqNumber = "REQ-" + datePrefix + "-" + randomSuffix;

        StockRequest request = new StockRequest();
        request.setRequestNumber(reqNumber);
        request.setBranch(branch);
        request.setRequestedByUsername(user != null ? user.getUsername() : "branch_user");
        request.setStatus("PENDING");
        request.setNotes(dto.getNotes());
        request.setCreatedAt(LocalDateTime.now());

        for (CreateStockRequestDTO.Item it : dto.getItems()) {
            ProductVariant variant = variantRepository.findById(it.getVariantId()).get();
            StockRequestItem item = new StockRequestItem();
            item.setStockRequest(request);
            item.setVariant(variant);
            item.setRequestedQuantity(it.getQuantity());
            item.setApprovedQuantity(0);
            item.setStatus("PENDING");
            request.getItems().add(item);
        }

        StockRequest saved = stockRequestRepository.save(request);

        stockWebSocketHandler.broadcastStockUpdate();

        return ResponseEntity.ok(formatRequestForUser(saved, user));
    }

    // ── 3. GET /api/stock-requests (List Requests) ──────────────────────────────
    @GetMapping
    public List<Map<String, Object>> getRequests(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal UserPrincipal user) {

        List<StockRequest> list;
        if (user != null && "BRANCH".equals(user.getRole())) {
            list = stockRequestRepository.findByBranchIdWithDetails(user.getBranchId());
        } else if (branchId != null) {
            list = stockRequestRepository.findByBranchIdWithDetails(branchId);
        } else {
            list = stockRequestRepository.findAllWithDetails();
        }

        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            list = list.stream().filter(r -> status.equalsIgnoreCase(r.getStatus())).toList();
        }

        return list.stream().map(r -> formatRequestForUser(r, user)).toList();
    }

    // ── 4. GET /api/stock-requests/{id} (Single Request Detail) ─────────────────
    @GetMapping("/{id}")
    public ResponseEntity<?> getRequestById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal user) {

        StockRequest request = stockRequestRepository.findByIdWithDetails(id).orElse(null);
        if (request == null) {
            return ResponseEntity.notFound().build();
        }

        if (user != null && "BRANCH".equals(user.getRole()) && !request.getBranch().getId().equals(user.getBranchId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied to other branch requests."));
        }

        return ResponseEntity.ok(formatRequestForUser(request, user));
    }

    // ── 5. DELETE /api/stock-requests/{id}/cancel (Branch Cancels Request) ──────
    @DeleteMapping("/{id}/cancel")
    @Transactional
    public ResponseEntity<?> cancelRequest(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal user) {

        StockRequest request = stockRequestRepository.findById(id).orElse(null);
        if (request == null) {
            return ResponseEntity.notFound().build();
        }

        if (user != null && "BRANCH".equals(user.getRole()) && !request.getBranch().getId().equals(user.getBranchId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied."));
        }

        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot cancel a request that is already " + request.getStatus() + "."));
        }

        request.setStatus("CANCELLED");
        request.setReviewedAt(LocalDateTime.now());
        request.setAdminNotes("Cancelled by branch user.");
        stockRequestRepository.save(request);

        stockWebSocketHandler.broadcastStockUpdate();

        return ResponseEntity.ok(Map.of("message", "Stock request cancelled successfully."));
    }

    // ── 6. POST /api/admin/stock-requests/{id}/approve (Admin Approves & Dispatches)
    @PostMapping("/admin/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> approveRequest(
            @PathVariable Long id,
            @RequestBody ApproveStockRequestDTO dto,
            @AuthenticationPrincipal UserPrincipal user) {

        StockRequest request = stockRequestRepository.findByIdWithDetails(id).orElse(null);
        if (request == null) {
            return ResponseEntity.notFound().build();
        }

        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Request is not in PENDING status. Current status: " + request.getStatus()));
        }

        if (dto.getDeadline() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Payment deadline is required for branch allocation."));
        }

        Branch targetBranch = request.getBranch();
        if (targetBranch == null || !targetBranch.isActive()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Target branch is inactive or not found."));
        }

        Map<Long, ApproveStockRequestDTO.ItemApproval> approvalMap = new HashMap<>();
        if (dto.getItems() != null) {
            for (ApproveStockRequestDTO.ItemApproval item : dto.getItems()) {
                approvalMap.put(item.getItemId(), item);
            }
        }

        String adminBatchId = UUID.randomUUID().toString();
        int totalDispatchedUnits = 0;

        for (StockRequestItem it : request.getItems()) {
            ApproveStockRequestDTO.ItemApproval approval = approvalMap.get(it.getId());

            int approvedQty = (approval != null && approval.getApprovedQuantity() != null)
                    ? approval.getApprovedQuantity()
                    : it.getRequestedQuantity();

            if (approvedQty <= 0) {
                it.setStatus("REJECTED");
                it.setApprovedQuantity(0);
                continue;
            }

            ProductVariant variant = it.getVariant();

            // Check holding pool has sufficient stock
            long available = stockBatchRepository.sumRemainingQuantityForHolding(variant.getId());
            if (approvedQty > available) {
                String name = (variant.getProduct() != null)
                        ? variant.getProduct().getBrandName() + " " + variant.getProduct().getModelName()
                        : "Variant #" + variant.getId();
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Insufficient holding stock for " + name + ". Available: " + available + ", approved: " + approvedQty
                ));
            }

            BigDecimal costPerUnit = (approval != null && approval.getCostPerUnit() != null)
                    ? approval.getCostPerUnit()
                    : (variant.getAcquisitionPrice() != null ? variant.getAcquisitionPrice() : BigDecimal.ZERO);

            BigDecimal totalCost = costPerUnit.multiply(BigDecimal.valueOf(approvedQty));

            // 1. Deduct from Master Storage holding batches (FIFO)
            List<StockBatch> holdingBatches = stockBatchRepository.findReceivableForHoldingForUpdate(variant.getId());
            int remaining = approvedQty;
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

            // 2. Record stock adjustment
            StockAdjustment adj = new StockAdjustment();
            adj.setVariant(variant);
            adj.setQuantity(approvedQty);
            adj.setReason("Dispatched for Request #" + request.getRequestNumber() + " to " + targetBranch.getName());
            adj.setNote("Allocation batch: " + adminBatchId);
            adj.setBranch(null);
            stockAdjustmentRepository.save(adj);

            // 3. Create new StockBatch at the branch
            StockBatch branchBatch = new StockBatch();
            branchBatch.setVariant(variant);
            branchBatch.setQuantity(approvedQty);
            branchBatch.setRemainingQuantity(approvedQty);
            branchBatch.setAcquisitionPrice(costPerUnit);
            branchBatch.setStatus("RECEIVED");
            branchBatch.setBranch(targetBranch);
            branchBatch.setBatchId(adminBatchId);
            branchBatch.setConsigned(false);
            StockBatch savedBatch = stockBatchRepository.save(branchBatch);

            // 4. Create BranchStockAllocation
            BranchStockAllocation allocation = new BranchStockAllocation();
            allocation.setBranch(targetBranch);
            allocation.setVariant(variant);
            allocation.setQuantity(approvedQty);
            allocation.setCostPerUnit(costPerUnit);
            allocation.setTotalCost(totalCost);
            allocation.setDeadline(dto.getDeadline());
            allocation.setAmountPaid(BigDecimal.ZERO);
            allocation.setStatus("PENDING");
            allocation.setNotes("Fulfillment for Request " + request.getRequestNumber() + (request.getNotes() != null ? ": " + request.getNotes() : ""));
            allocation.setAdminBatchId(adminBatchId);
            allocation.setStockBatchId(savedBatch.getId());
            allocationRepo.save(allocation);

            // 5. Update branch selling price if specified
            if (approval != null && approval.getSellingPrice() != null && approval.getSellingPrice().compareTo(BigDecimal.ZERO) >= 0) {
                BranchSellingPrice bsp = branchSellingPriceRepository
                        .findByBranchIdAndVariantId(targetBranch.getId(), variant.getId())
                        .orElseGet(() -> {
                            BranchSellingPrice newBsp = new BranchSellingPrice();
                            newBsp.setBranch(targetBranch);
                            newBsp.setVariant(variant);
                            return newBsp;
                        });
                bsp.setSellingPrice(approval.getSellingPrice());
                branchSellingPriceRepository.save(bsp);
            }

            it.setApprovedQuantity(approvedQty);
            it.setStatus("APPROVED");
            totalDispatchedUnits += approvedQty;
        }

        request.setStatus("APPROVED");
        request.setAdminBatchId(adminBatchId);
        request.setReviewedAt(LocalDateTime.now());
        request.setReviewedByUsername(user != null ? user.getUsername() : "admin");
        request.setAdminNotes(dto.getAdminNotes());
        stockRequestRepository.save(request);

        stockWebSocketHandler.broadcastStockUpdate();

        return ResponseEntity.ok(Map.of(
                "message", "Stock request approved and " + totalDispatchedUnits + " units dispatched to " + targetBranch.getName(),
                "requestNumber", request.getRequestNumber(),
                "adminBatchId", adminBatchId,
                "status", "APPROVED"
        ));
    }

    // ── 7. POST /api/admin/stock-requests/{id}/reject (Admin Declines Request) ──
    @PostMapping("/admin/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> rejectRequest(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal user) {

        StockRequest request = stockRequestRepository.findByIdWithDetails(id).orElse(null);
        if (request == null) {
            return ResponseEntity.notFound().build();
        }

        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Request is not in PENDING status."));
        }

        String reason = (body != null && body.containsKey("reason")) ? body.get("reason") : "Declined by Admin";

        request.setStatus("REJECTED");
        request.setReviewedAt(LocalDateTime.now());
        request.setReviewedByUsername(user != null ? user.getUsername() : "admin");
        request.setAdminNotes(reason);

        for (StockRequestItem it : request.getItems()) {
            it.setStatus("REJECTED");
            it.setApprovedQuantity(0);
        }

        stockRequestRepository.save(request);
        stockWebSocketHandler.broadcastStockUpdate();

        return ResponseEntity.ok(Map.of(
                "message", "Stock request #" + request.getRequestNumber() + " declined.",
                "status", "REJECTED"
        ));
    }

    // ── Helper: Format response with role-based cost price masking ───────────────
    private Map<String, Object> formatRequestForUser(StockRequest r, UserPrincipal user) {
        boolean isAdmin = user != null && "ADMIN".equals(user.getRole());

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", r.getId());
        map.put("requestNumber", r.getRequestNumber());
        map.put("branchId", r.getBranch() != null ? r.getBranch().getId() : null);
        map.put("branchName", r.getBranch() != null ? r.getBranch().getName() : "Unknown");
        map.put("requestedBy", r.getRequestedByUsername());
        map.put("status", r.getStatus());
        map.put("notes", r.getNotes());
        map.put("adminNotes", r.getAdminNotes());
        map.put("adminBatchId", r.getAdminBatchId());
        map.put("createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
        map.put("reviewedAt", r.getReviewedAt() != null ? r.getReviewedAt().toString() : null);
        map.put("reviewedBy", r.getReviewedByUsername());

        List<Map<String, Object>> items = new ArrayList<>();
        int totalRequestedUnits = 0;
        int totalApprovedUnits = 0;

        for (StockRequestItem it : r.getItems()) {
            ProductVariant v = it.getVariant();
            Product p = v != null ? v.getProduct() : null;

            Map<String, Object> itMap = new LinkedHashMap<>();
            itMap.put("id", it.getId());
            itMap.put("variantId", v != null ? v.getId() : null);
            itMap.put("brandName", p != null ? p.getBrandName() : "");
            itMap.put("modelName", p != null ? p.getModelName() : "");
            itMap.put("category", p != null ? p.getCategory() : "General");
            itMap.put("sku", v != null ? v.getSku() : "");
            itMap.put("color", v != null ? v.getColor() : "");
            itMap.put("shape", v != null ? v.getShape() : "");
            itMap.put("thicknessMm", v != null ? v.getThicknessMm() : "");
            itMap.put("sellingPrice", v != null ? v.getSellingPrice() : BigDecimal.ZERO);
            itMap.put("requestedQuantity", it.getRequestedQuantity());
            itMap.put("approvedQuantity", it.getApprovedQuantity());
            itMap.put("status", it.getStatus());

            // Current Master holding stock (useful for reviewer)
            if (v != null) {
                long masterHolding = stockBatchRepository.sumRemainingQuantityForHolding(v.getId());
                itMap.put("masterStockAvailable", masterHolding);
            }

            // ONLY ADMIN sees acquisition/cost price!
            if (isAdmin && v != null) {
                itMap.put("acquisitionPrice", v.getAcquisitionPrice());
            }

            totalRequestedUnits += it.getRequestedQuantity() != null ? it.getRequestedQuantity() : 0;
            totalApprovedUnits += it.getApprovedQuantity() != null ? it.getApprovedQuantity() : 0;

            items.add(itMap);
        }

        map.put("items", items);
        map.put("totalRequestedUnits", totalRequestedUnits);
        map.put("totalApprovedUnits", totalApprovedUnits);

        return map;
    }
}
