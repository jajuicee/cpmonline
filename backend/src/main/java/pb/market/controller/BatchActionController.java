package pb.market.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import pb.market.config.StockWebSocketHandler;
import pb.market.dto.BatchAddRequest;
import pb.market.entity.Expense;
import pb.market.entity.ProductVariant;
import pb.market.entity.StockBatch;
import pb.market.entity.Supplier;
import pb.market.entity.Transaction;
import pb.market.repository.ExpenseRepository;
import pb.market.repository.StockBatchRepository;
import pb.market.repository.SupplierRepository;
import pb.market.repository.VariantRepository;
import pb.market.repository.TransactionRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/batch-actions")
@CrossOrigin(origins = "*")
public class BatchActionController {

    @Autowired
    private StockBatchRepository stockBatchRepository;
    @Autowired
    private VariantRepository variantRepository;
    @Autowired
    private SupplierRepository supplierRepository;
    @Autowired
    private ExpenseRepository expenseRepository;
    @Autowired
    private TransactionRepository transactionRepository;
    @Autowired
    private pb.market.repository.BranchRepository branchRepository;
    @Autowired
    private pb.market.repository.StockAdjustmentRepository stockAdjustmentRepository;
    @Autowired
    private StockWebSocketHandler stockWebSocketHandler;

    private pb.market.entity.Branch getMainBranch() {
        List<pb.market.entity.Branch> branches = branchRepository.findAll();
        return branches.stream()
                .filter(b -> b.getName() != null && b.getName().toLowerCase().contains("main"))
                .findFirst()
                .orElseGet(() -> branches.stream()
                        .filter(b -> b.getId() != null && b.getId() == 1L)
                        .findFirst()
                        .orElseGet(() -> branches.isEmpty() ? null : branches.get(0)));
    }

    private boolean isMainBranch(pb.market.entity.Branch b) {
        if (b == null) return true;
        if (b.getName() != null && b.getName().toLowerCase().contains("main")) return true;
        pb.market.entity.Branch main = getMainBranch();
        return main != null && b.getId() != null && b.getId().equals(main.getId());
    }

    @PostMapping("/receive")
    @Transactional
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> receiveBatch(
            @RequestBody BatchAddRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Batch must contain items."));
        }

        pb.market.entity.Branch branch = null;
        Long bId = (user != null && "BRANCH".equals(user.getRole())) ? user.getBranchId() : request.getBranchId();
        if (bId != null) {
            branch = branchRepository.findById(bId).orElse(null);
        }

        pb.market.entity.Branch mainBranch = getMainBranch();
        boolean isTransferFromMain = (branch != null && !isMainBranch(branch));

        Supplier supplier = null;
        if (request.getSupplierId() != null) {
            var supplierOpt = supplierRepository.findById(request.getSupplierId());
            if (supplierOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Supplier not found with id: " + request.getSupplierId()));
            }
            supplier = supplierOpt.get();
        }

        // Calculate total items
        int totalItems = request.getItems().stream().mapToInt(BatchAddRequest.BatchItem::getQuantity).sum();
        if (totalItems <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Total quantity must be greater than 0."));
        }

        // Validate all variant IDs before creating any batches
        for (BatchAddRequest.BatchItem item : request.getItems()) {
            if (!variantRepository.existsById(item.getVariantId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Variant not found with id: " + item.getVariantId()));
            }
        }

        // If transferring to another branch, validate that Main Inventory has sufficient stock for ALL items
        if (isTransferFromMain) {
            Long mainBranchId = mainBranch != null ? mainBranch.getId() : 1L;
            for (BatchAddRequest.BatchItem item : request.getItems()) {
                List<StockBatch> mainBatches = stockBatchRepository
                        .findReceivableForMainForUpdate(item.getVariantId(), mainBranchId);
                int availableInMain = mainBatches.stream()
                        .mapToInt(b -> b.getRemainingQuantity() != null ? b.getRemainingQuantity() : 0)
                        .sum();
                if (item.getQuantity() > availableInMain) {
                    ProductVariant v = variantRepository.findById(item.getVariantId()).orElse(null);
                    String name = (v != null && v.getProduct() != null)
                            ? v.getProduct().getBrandName() + " " + v.getProduct().getModelName() + " (" + v.getSku() + ")"
                            : "Variant ID #" + item.getVariantId();
                    return ResponseEntity.badRequest().body(Map.of(
                        "error", "Cannot add to " + branch.getName() + ": Insufficient stock in Main Inventory for " + name +
                                ". Available in Main: " + availableInMain + ", requested: " + item.getQuantity() + "."
                    ));
                }
            }
        }

        BigDecimal grandTotal = request.getTotalExpense() != null ? request.getTotalExpense() : BigDecimal.ZERO;
        String batchId = UUID.randomUUID().toString();

        for (BatchAddRequest.BatchItem item : request.getItems()) {
            ProductVariant variant = variantRepository.findById(item.getVariantId()).get();

            // Determine status: INCOMING batches don't add to sellable stock yet
            String status = request.getStatus() != null && request.getStatus().equals("INCOMING") ? "INCOMING"
                    : "RECEIVED";

            // If transferring to another branch, subtract stock from Main Inventory (FIFO)
            if (isTransferFromMain) {
                Long mainBranchId = mainBranch != null ? mainBranch.getId() : 1L;
                List<StockBatch> mainBatches = stockBatchRepository
                        .findReceivableForMainForUpdate(item.getVariantId(), mainBranchId);

                int remainingToDeduct = item.getQuantity();
                for (StockBatch mainBatch : mainBatches) {
                    if (remainingToDeduct <= 0) break;
                    int available = mainBatch.getRemainingQuantity() != null ? mainBatch.getRemainingQuantity() : 0;
                    if (available >= remainingToDeduct) {
                        mainBatch.setRemainingQuantity(available - remainingToDeduct);
                        remainingToDeduct = 0;
                    } else {
                        mainBatch.setRemainingQuantity(0);
                        remainingToDeduct -= available;
                    }
                    stockBatchRepository.save(mainBatch);
                }

                // Persist the stock adjustment record on Main Inventory
                pb.market.entity.StockAdjustment adj = new pb.market.entity.StockAdjustment();
                adj.setVariant(variant);
                adj.setQuantity(item.getQuantity());
                adj.setReason("Transfer to " + branch.getName());
                adj.setNote("Stock transfer to branch: " + branch.getName() + " (Batch " + batchId + ")");
                adj.setBranch(mainBranch);
                stockAdjustmentRepository.save(adj);
            }

            // 2. Create StockBatch for target branch
            BigDecimal itemBaseCost = (item.getBaseCost() != null && item.getBaseCost().compareTo(BigDecimal.ZERO) > 0)
                    ? item.getBaseCost()
                    : (variant.getAcquisitionPrice() != null ? variant.getAcquisitionPrice() : BigDecimal.ZERO);

            Supplier itemSupplier = supplier != null ? supplier : variant.getDefaultSupplier();
            boolean isItemConsigned = item.getConsigned() != null ? item.getConsigned() : request.isConsigned();

            StockBatch batch = new StockBatch();
            batch.setVariant(variant);
            batch.setQuantity(item.getQuantity());
            // remainingQuantity: full quantity if RECEIVED, 0 if INCOMING
            batch.setRemainingQuantity("RECEIVED".equals(status) ? item.getQuantity() : 0);
            batch.setAcquisitionPrice(itemBaseCost);
            batch.setSupplier(itemSupplier);
            batch.setConsigned(isItemConsigned);
            batch.setStatus(status);
            batch.setEta(request.getEta());
            batch.setBatchId(batchId);
            batch.setBranch(branch);
            stockBatchRepository.save(batch);
        }

        // 3. Log Expense only if actual money was spent and it's not an internal branch transfer
        if (!isTransferFromMain && grandTotal.compareTo(BigDecimal.ZERO) > 0) {
            Expense expense = new Expense();
            expense.setName(supplier != null ? "Paddles from " + supplier.getName() : "Paddles Batch Purchase");
            expense.setCategory("Business");
            expense.setCost(grandTotal);
            expense.setBatchId(batchId);
            expense.setBranch(branch);
            expense.setNote("Auto-generated from Batch " + (request.getStatus() != null ? request.getStatus() : "RECEIVED")
                    + ". Total items: " + totalItems + ".");
            expenseRepository.save(expense);
        }

        stockWebSocketHandler.broadcastStockUpdate();
        return ResponseEntity.ok(Map.of(
                "message", isTransferFromMain 
                        ? "Successfully transferred and received stock at " + branch.getName() + " (deducted from Main Inventory)."
                        : "Batch received successfully",
                "batchId", batchId,
                "grandTotal", grandTotal));
    }

    @DeleteMapping("/revert/{batchId}")
    @Transactional
    public ResponseEntity<?> revertBatch(@PathVariable("batchId") String batchId) {
        // 1. Find all batches in this group
        List<StockBatch> batches = stockBatchRepository.findByBatchId(batchId);
        if (batches.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        // 2. Guard: block revert if any units from this batch have already been sold.
        //    A sold unit = remainingQuantity < quantity (the difference was sold/deducted).
        //    We check this instead of relying on transaction references so it works even for
        //    manual deductions (deduct-stock endpoint) not tied to a transaction record.
        for (StockBatch batch : batches) {
            int original = batch.getQuantity() != null ? batch.getQuantity() : 0;
            int remaining = batch.getRemainingQuantity() != null ? batch.getRemainingQuantity() : 0;
            int soldFromBatch = original - remaining;
            if (soldFromBatch > 0) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Cannot revert batch: " + soldFromBatch + " unit(s) from this batch have already been sold or deducted. " +
                              "Revert is only allowed while stock is untouched."
                ));
            }
        }

        // 3. Find any transactions referencing these batches and null them out
        // (Prevents FK constraint violation 500 error)
        List<Transaction> referencingTransactions = transactionRepository.findByStockBatchIn(batches);
        for (Transaction tx : referencingTransactions) {
            tx.setStockBatch(null);
            transactionRepository.save(tx);
        }

        // 4. If this batch was transferred to a non-main branch, restore stock back to Main Inventory
        for (StockBatch batch : batches) {
            if (batch.getBranch() != null && !isMainBranch(batch.getBranch())) {
                pb.market.entity.Branch mainBranch = getMainBranch();
                Long mainBranchId = mainBranch != null ? mainBranch.getId() : 1L;
                List<StockBatch> mainBatches = stockBatchRepository.findByVariantIdAndStatusOrderByRestockedAtDesc(
                        batch.getVariant().getId(), "RECEIVED");
                StockBatch targetMainBatch = mainBatches.stream()
                        .filter(b -> (b.getBranch() != null && b.getBranch().getId().equals(mainBranchId)) || b.getBranch() == null)
                        .findFirst()
                        .orElse(null);

                int qtyToRestore = batch.getQuantity() != null ? batch.getQuantity() : 0;
                if (targetMainBatch != null) {
                    targetMainBatch.setRemainingQuantity((targetMainBatch.getRemainingQuantity() != null ? targetMainBatch.getRemainingQuantity() : 0) + qtyToRestore);
                    stockBatchRepository.save(targetMainBatch);
                } else {
                    StockBatch restoredBatch = new StockBatch();
                    restoredBatch.setVariant(batch.getVariant());
                    restoredBatch.setQuantity(qtyToRestore);
                    restoredBatch.setRemainingQuantity(qtyToRestore);
                    restoredBatch.setAcquisitionPrice(batch.getAcquisitionPrice());
                    restoredBatch.setSupplier(batch.getSupplier());
                    restoredBatch.setConsigned(batch.isConsigned());
                    restoredBatch.setStatus("RECEIVED");
                    restoredBatch.setBranch(mainBranch);
                    restoredBatch.setBatchId("RESTORE-" + UUID.randomUUID().toString().substring(0, 8));
                    stockBatchRepository.save(restoredBatch);
                }

                // Persist restoration adjustment
                pb.market.entity.StockAdjustment adj = new pb.market.entity.StockAdjustment();
                adj.setVariant(batch.getVariant());
                adj.setQuantity(qtyToRestore);
                adj.setReason("Revert Transfer from " + batch.getBranch().getName());
                adj.setNote("Restored stock to Main Inventory after reverting batch: " + batchId);
                adj.setBranch(mainBranch);
                stockAdjustmentRepository.save(adj);
            }
        }

        // 5. Delete linked expenses
        expenseRepository.deleteAll(expenseRepository.findByBatchId(batchId));

        // 6. Delete the batches
        stockBatchRepository.deleteAll(batches);

        stockWebSocketHandler.broadcastStockUpdate();
        return ResponseEntity.ok(Map.of("message", "Batch " + batchId + " has been reverted successfully."));
    }

    @GetMapping("/history")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getBatchHistory() {
        // Single JOIN FETCH query — no N+1 lazy loading
        List<StockBatch> batches = stockBatchRepository.findAllWithVariantAndProduct();
        Map<String, List<StockBatch>> grouped = batches.stream()
                .collect(Collectors.groupingBy(StockBatch::getBatchId));

        List<Expense> expenses = expenseRepository.findAll();
        Map<String, BigDecimal> expenseMap = expenses.stream()
                .filter(e -> e.getBatchId() != null)
                .collect(Collectors.groupingBy(Expense::getBatchId,
                        Collectors.mapping(
                                e -> e.getCost() != null ? e.getCost() : BigDecimal.ZERO,
                                Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));

        List<Map<String, Object>> result = grouped.entrySet().stream().map(entry -> {
            String batchId = entry.getKey();
            List<StockBatch> items = entry.getValue();
            StockBatch first = items.get(0);

            BigDecimal totalExpense = expenseMap.getOrDefault(batchId, BigDecimal.ZERO);

            // Collect item details
            List<Map<String, Object>> itemDtos = items.stream().map(item -> {
                Map<String, Object> i = new java.util.HashMap<>();
                i.put("variantId", item.getVariant().getId());
                i.put("sku", item.getVariant().getSku());
                i.put("name", item.getVariant().getProduct().getBrandName() + " "
                        + item.getVariant().getProduct().getModelName() + " (" + item.getVariant().getColor() + ")");
                i.put("quantity", item.getQuantity());
                i.put("baseCost", item.getAcquisitionPrice());
                return i;
            }).collect(Collectors.toList());

            int totalQty = items.stream().mapToInt(StockBatch::getQuantity).sum();

            Map<String, Object> batchMap = new java.util.HashMap<>();
            batchMap.put("batchId", batchId);
            batchMap.put("date", first.getRestockedAt() != null ? first.getRestockedAt() : java.time.LocalDateTime.MIN);
            batchMap.put("eta", first.getEta());
            batchMap.put("supplier", first.getSupplier() != null ? first.getSupplier().getName() : "Unknown");
            batchMap.put("status", first.getStatus() != null ? first.getStatus() : "RECEIVED");
            batchMap.put("totalQuantity", totalQty);
            batchMap.put("totalExpense", totalExpense);
            batchMap.put("items", itemDtos);
            return batchMap;
        })
                .sorted((a, b) -> {
                    java.time.LocalDateTime dateA = (java.time.LocalDateTime) a.get("date");
                    java.time.LocalDateTime dateB = (java.time.LocalDateTime) b.get("date");
                    return dateB.compareTo(dateA);
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @PostMapping("/{batchId}/mark-received")
    @Transactional
    public ResponseEntity<?> markBatchReceived(@PathVariable("batchId") String batchId) {
        List<StockBatch> batches = stockBatchRepository.findByBatchId(batchId);

        boolean updated = false;
        for (StockBatch batch : batches) {
            if ("INCOMING".equals(batch.getStatus())) {
                batch.setStatus("RECEIVED");
                batch.setRemainingQuantity(batch.getQuantity());
                stockBatchRepository.save(batch);
                updated = true;
            }
        }

        if (updated) {
            expenseRepository.findByBatchId(batchId).stream()
                    .findFirst()
                    .ifPresent(e -> {
                        e.setNote(e.getNote().replace("INCOMING", "RECEIVED"));
                        expenseRepository.save(e);
                    });
            stockWebSocketHandler.broadcastStockUpdate();
        }

        return ResponseEntity.ok(Map.of("message", "Batch marked as received."));
    }
}
