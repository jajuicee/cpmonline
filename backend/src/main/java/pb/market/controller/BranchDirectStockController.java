package pb.market.controller;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import pb.market.config.StockWebSocketHandler;
import pb.market.config.UserPrincipal;
import pb.market.dto.BranchDirectStockRequest;
import pb.market.entity.*;
import pb.market.repository.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/branch/direct-stock")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class BranchDirectStockController {

    private final StockBatchRepository stockBatchRepository;
    private final VariantRepository variantRepository;
    private final BranchRepository branchRepository;
    private final SupplierRepository supplierRepository;
    private final TransactionRepository transactionRepository;
    private final BranchSellingPriceRepository branchSellingPriceRepository;
    private final StockWebSocketHandler stockWebSocketHandler;

    // ─── 1. Add Direct Stock to Branch ─────────────────────────────────────────
    @PostMapping
    @Transactional
    public ResponseEntity<?> addDirectStock(
            @RequestBody BranchDirectStockRequest request,
            @AuthenticationPrincipal UserPrincipal user) {

        // Validate supplier — REQUIRED
        if (request.getSupplierId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Supplier is required for Branch Direct stock."));
        }
        Supplier supplier = supplierRepository.findById(request.getSupplierId()).orElse(null);
        if (supplier == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Supplier not found with id: " + request.getSupplierId()));
        }

        // Validate branch
        Long targetBranchId = request.getBranchId();
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            targetBranchId = user.getBranchId();
        }
        if (targetBranchId == null || targetBranchId <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Target branch is required."));
        }
        Branch branch = branchRepository.findById(targetBranchId).orElse(null);
        if (branch == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Branch not found with id: " + targetBranchId));
        }

        // Validate items
        if (request.getItems() == null || request.getItems().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "At least one product item is required."));
        }

        String batchSessionId = "DIRECT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        List<Map<String, Object>> createdItems = new ArrayList<>();
        int totalUnits = 0;

        for (BranchDirectStockRequest.DirectStockItem item : request.getItems()) {
            if (item.getVariantId() == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "variantId is required for all items."));
            }
            if (item.getQuantity() == null || item.getQuantity() <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Quantity must be greater than zero."));
            }

            ProductVariant variant = variantRepository.findById(item.getVariantId()).orElse(null);
            if (variant == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Product variant not found with id: " + item.getVariantId()));
            }

            BigDecimal acqCost = item.getAcquisitionPrice() != null
                    ? item.getAcquisitionPrice()
                    : (variant.getAcquisitionPrice() != null ? variant.getAcquisitionPrice() : BigDecimal.ZERO);

            // Optional: update branch-specific selling price if requested
            if (item.getSellingPrice() != null && item.getSellingPrice().compareTo(BigDecimal.ZERO) > 0) {
                BranchSellingPrice bsp = branchSellingPriceRepository
                        .findByBranchIdAndVariantId(branch.getId(), variant.getId())
                        .orElseGet(() -> {
                            BranchSellingPrice newBsp = new BranchSellingPrice();
                            newBsp.setBranch(branch);
                            newBsp.setVariant(variant);
                            return newBsp;
                        });
                bsp.setSellingPrice(item.getSellingPrice());
                branchSellingPriceRepository.save(bsp);
            }

            // Create StockBatch directly at the branch
            StockBatch batch = new StockBatch();
            batch.setVariant(variant);
            batch.setBranch(branch);
            batch.setSupplier(supplier);
            batch.setQuantity(item.getQuantity());
            batch.setRemainingQuantity(item.getQuantity());
            batch.setAcquisitionPrice(acqCost);
            batch.setConsigned(false);
            batch.setBranchDirect(true);
            batch.setSourceType("BRANCH_DIRECT");
            batch.setStatus("RECEIVED");
            batch.setBatchId(batchSessionId);
            batch.setRestockedAt(LocalDateTime.now());
            stockBatchRepository.save(batch);

            totalUnits += item.getQuantity();

            Map<String, Object> itemMap = new LinkedHashMap<>();
            itemMap.put("variantId", variant.getId());
            itemMap.put("sku", variant.getSku());
            itemMap.put("quantity", item.getQuantity());
            itemMap.put("acquisitionPrice", acqCost);
            createdItems.add(itemMap);
        }

        stockWebSocketHandler.broadcastStockUpdate();

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", String.format("Successfully added %d unit(s) directly to %s from %s!",
                        totalUnits, branch.getName(), supplier.getName()),
                "batchId", batchSessionId,
                "branchId", branch.getId(),
                "branchName", branch.getName(),
                "supplierId", supplier.getId(),
                "supplierName", supplier.getName(),
                "totalUnits", totalUnits,
                "items", createdItems
        ));
    }

    // ─── 2. List Batches for Branch (with Direct Stock details) ────────────────
    @GetMapping("/batches")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getBatches(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "150") int limit,
            @AuthenticationPrincipal UserPrincipal user) {

        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            branchId = user.getBranchId();
        }

        String stFilter = (sourceType != null && !sourceType.isBlank() && !"ALL".equalsIgnoreCase(sourceType))
                ? sourceType.toUpperCase() : null;
        String sQuery = (search != null && !search.isBlank()) ? "%" + search.trim().toLowerCase() + "%" : null;
        org.springframework.data.domain.Pageable page = org.springframework.data.domain.PageRequest.of(0, Math.min(limit, 500));

        List<StockBatch> list = stockBatchRepository.findBatchesForTagging(branchId, stFilter, sQuery, page);

        List<Map<String, Object>> response = list.stream().map(b -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", b.getId());
            m.put("batchId", b.getBatchId());
            m.put("branchDirect", b.isBranchDirect());
            m.put("sourceType", b.getSourceType() != null ? b.getSourceType() : "ALLOCATED");
            m.put("quantity", b.getQuantity());
            m.put("remainingQuantity", b.getRemainingQuantity());
            m.put("acquisitionPrice", b.getAcquisitionPrice());
            m.put("restockedAt", b.getRestockedAt());
            m.put("status", b.getStatus());
            if (b.getBranch() != null) {
                m.put("branch", Map.of("id", b.getBranch().getId(), "name", b.getBranch().getName()));
            } else {
                m.put("branch", Map.of("id", 0L, "name", "Admin Holding Pool"));
            }
            if (b.getSupplier() != null) {
                m.put("supplier", Map.of("id", b.getSupplier().getId(), "name", b.getSupplier().getName()));
            } else {
                m.put("supplier", null);
            }
            if (b.getVariant() != null) {
                m.put("variant", Map.of(
                        "id", b.getVariant().getId(),
                        "sku", b.getVariant().getSku(),
                        "name", (b.getVariant().getProduct() != null ? b.getVariant().getProduct().getBrandName() + " " + b.getVariant().getProduct().getModelName() : b.getVariant().getSku())
                ));
            }
            return m;
        }).toList();

        return ResponseEntity.ok(response);
    }

    // ─── 3. Retroactive Batch Tagging (Single & Bulk) ─────────────────────────
    @Data
    public static class TagBatchRequest {
        private String sourceType; // "BRANCH_DIRECT" or "ALLOCATED"
        private Long supplierId;
        private Boolean updateTransactions = true;
    }

    @Data
    public static class TagBatchesRequest {
        private List<Long> batchIds;
        private String sourceType; // "BRANCH_DIRECT" or "ALLOCATED"
        private Long supplierId;
        private Boolean updateTransactions = true;
    }

    @PostMapping("/tag-batches")
    @Transactional
    public ResponseEntity<?> tagBatchesBulk(@RequestBody TagBatchesRequest req) {
        if (req.getBatchIds() == null || req.getBatchIds().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No batchIds provided."));
        }

        String newSourceType = req.getSourceType() != null && !req.getSourceType().isBlank()
                ? req.getSourceType().trim().toUpperCase()
                : "BRANCH_DIRECT";
        boolean isDirect = "BRANCH_DIRECT".equalsIgnoreCase(newSourceType);

        Supplier newSupplier = null;
        if (req.getSupplierId() != null) {
            newSupplier = supplierRepository.findById(req.getSupplierId()).orElse(null);
        }

        List<StockBatch> batches = stockBatchRepository.findAllById(req.getBatchIds());
        for (StockBatch b : batches) {
            b.setSourceType(newSourceType);
            b.setBranchDirect(isDirect);
            if (newSupplier != null) {
                b.setSupplier(newSupplier);
            }
            stockBatchRepository.save(b);
        }

        int updatedTxCount = 0;
        if (Boolean.TRUE.equals(req.getUpdateTransactions()) && !batches.isEmpty()) {
            List<Transaction> txs = transactionRepository.findByStockBatchIn(batches);
            for (Transaction t : txs) {
                t.setSourceType(newSourceType);
                if (newSupplier != null) {
                    t.setSupplier(newSupplier);
                }
                transactionRepository.save(t);
                updatedTxCount++;
            }
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "updatedBatchesCount", batches.size(),
                "updatedTransactionsCount", updatedTxCount,
                "sourceType", newSourceType,
                "supplierName", newSupplier != null ? newSupplier.getName() : null,
                "message", String.format("Successfully tagged %d batch(es) and %d linked transaction(s) as %s.",
                        batches.size(), updatedTxCount, newSourceType)
        ));
    }

    @PatchMapping("/batches/{id}/tag")
    @Transactional
    public ResponseEntity<?> tagBatch(
            @PathVariable Long id,
            @RequestBody TagBatchRequest req) {

        StockBatch batch = stockBatchRepository.findById(id).orElse(null);
        if (batch == null) {
            return ResponseEntity.notFound().build();
        }

        String newSourceType = req.getSourceType() != null && !req.getSourceType().isBlank()
                ? req.getSourceType().trim().toUpperCase()
                : "BRANCH_DIRECT";

        boolean isDirect = "BRANCH_DIRECT".equalsIgnoreCase(newSourceType);
        batch.setSourceType(newSourceType);
        batch.setBranchDirect(isDirect);

        Supplier newSupplier = null;
        if (req.getSupplierId() != null) {
            newSupplier = supplierRepository.findById(req.getSupplierId()).orElse(null);
            if (newSupplier != null) {
                batch.setSupplier(newSupplier);
            }
        }
        stockBatchRepository.save(batch);

        // Also sync all transactions previously deducted from this batch
        int updatedTxCount = 0;
        if (Boolean.TRUE.equals(req.getUpdateTransactions())) {
            List<Transaction> txs = transactionRepository.findByStockBatchIn(List.of(batch));
            for (Transaction t : txs) {
                t.setSourceType(newSourceType);
                if (newSupplier != null) {
                    t.setSupplier(newSupplier);
                }
                transactionRepository.save(t);
                updatedTxCount++;
            }
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "batchId", batch.getId(),
                "sourceType", batch.getSourceType(),
                "branchDirect", batch.isBranchDirect(),
                "supplierName", batch.getSupplier() != null ? batch.getSupplier().getName() : null,
                "updatedTransactionsCount", updatedTxCount,
                "message", "Batch tagged as " + newSourceType + " successfully."
        ));
    }

    // ─── 4. Retroactive Transaction Tagging (Single or Bulk) ───────────────────
    @Data
    public static class TagTransactionsRequest {
        private List<Long> transactionIds;
        private String sourceType; // "BRANCH_DIRECT" or "ALLOCATED"
        private Long supplierId;
    }

    @PostMapping("/tag-transactions")
    @Transactional
    public ResponseEntity<?> tagTransactions(@RequestBody TagTransactionsRequest req) {
        if (req.getTransactionIds() == null || req.getTransactionIds().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No transactionIds provided."));
        }

        String newSourceType = req.getSourceType() != null && !req.getSourceType().isBlank()
                ? req.getSourceType().trim().toUpperCase()
                : "BRANCH_DIRECT";

        Supplier supplier = null;
        if (req.getSupplierId() != null) {
            supplier = supplierRepository.findById(req.getSupplierId()).orElse(null);
        }

        int updatedCount = 0;
        List<Transaction> txs = transactionRepository.findAllById(req.getTransactionIds());
        for (Transaction t : txs) {
            t.setSourceType(newSourceType);
            if (supplier != null) {
                t.setSupplier(supplier);
            }
            transactionRepository.save(t);
            updatedCount++;
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "updatedCount", updatedCount,
                "sourceType", newSourceType,
                "supplierName", supplier != null ? supplier.getName() : null,
                "message", String.format("Successfully tagged %d transaction(s) as %s.", updatedCount, newSourceType)
        ));
    }

    // ─── 5. Fetch Transactions for Tagging UI ──────────────────────────────────
    @GetMapping("/transactions-for-tagging")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getTransactionsForTagging(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "100") int limit,
            @AuthenticationPrincipal UserPrincipal user) {

        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            branchId = user.getBranchId();
        }

        org.springframework.data.domain.Pageable page = org.springframework.data.domain.PageRequest.of(0, Math.min(limit, 500));
        String stFilter = (sourceType != null && !sourceType.isBlank() && !"ALL".equalsIgnoreCase(sourceType))
                ? sourceType.toUpperCase() : null;
        String sQuery = (search != null && !search.isBlank()) ? "%" + search.trim().toLowerCase() + "%" : null;

        List<Transaction> txs = transactionRepository.findByBranchAndSourceType(branchId, stFilter, sQuery, page);

        List<Map<String, Object>> response = txs.stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("orderId", t.getTransactionId() != null ? t.getTransactionId() : "TX-" + t.getId());
            m.put("transactionDate", t.getTransactionDate());
            m.put("customerName", t.getCustomerName());
            m.put("finalPrice", t.getFinalPrice());
            m.put("costPrice", t.getCostPrice());
            m.put("sourceType", t.getSourceType() != null ? t.getSourceType() : "ALLOCATED");
            m.put("status", t.getStatus());
            if (t.getBranch() != null) {
                m.put("branch", Map.of("id", t.getBranch().getId(), "name", t.getBranch().getName()));
            } else {
                m.put("branch", Map.of("id", 0L, "name", "Admin HQ"));
            }
            if (t.getSupplier() != null) {
                m.put("supplier", Map.of("id", t.getSupplier().getId(), "name", t.getSupplier().getName()));
            } else if (t.getStockBatch() != null && t.getStockBatch().getSupplier() != null) {
                m.put("supplier", Map.of("id", t.getStockBatch().getSupplier().getId(), "name", t.getStockBatch().getSupplier().getName()));
            } else if (t.getVariant() != null && t.getVariant().getDefaultSupplier() != null) {
                m.put("supplier", Map.of("id", t.getVariant().getDefaultSupplier().getId(), "name", t.getVariant().getDefaultSupplier().getName()));
            } else {
                m.put("supplier", null);
            }
            if (t.getVariant() != null) {
                m.put("variant", Map.of(
                        "id", t.getVariant().getId(),
                        "sku", t.getVariant().getSku(),
                        "name", (t.getVariant().getProduct() != null ? t.getVariant().getProduct().getBrandName() + " " + t.getVariant().getProduct().getModelName() : t.getVariant().getSku())
                ));
            }
            return m;
        }).toList();

        return ResponseEntity.ok(response);
    }
}

