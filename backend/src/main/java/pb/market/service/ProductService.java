package pb.market.service;

import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pb.market.entity.*;
import pb.market.repository.BranchRepository;
import pb.market.repository.ProductRepository;
import pb.market.repository.StockAdjustmentRepository;
import pb.market.repository.StockBatchRepository;
import pb.market.repository.SupplierRepository;
import pb.market.repository.TransactionRepository;
import pb.market.repository.VariantRepository;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {
    private final ProductRepository productRepository;
    private final VariantRepository variantRepository;
    private final StockBatchRepository stockBatchRepository;
    private final SupplierRepository supplierRepository;
    private final TransactionRepository transactionRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final BranchRepository branchRepository;
    private final pb.market.repository.BranchSellingPriceRepository branchSellingPriceRepository;
    private final EntityManager entityManager;

/*
    @PostConstruct
    @Transactional
    public void migrateLegacyTransactions() {
        // Find all transactions where supplier is null
        List<Transaction> legacy = transactionRepository.findAll().stream()
                .filter(t -> t.getSupplier() == null)
                .collect(Collectors.toList());

        if (!legacy.isEmpty()) {
            for (Transaction t : legacy) {
                ProductVariant v = t.getVariant();
                if (v != null) {
                    t.setSupplier(v.getDefaultSupplier());
                    t.setConsigned(v.isConsigned());
                }
            }
            transactionRepository.saveAll(legacy);
        }
    }
*/

    // Deprecated helpers kept for backwards compatibility with any remaining callers
    public Branch getMainBranch() {
        List<Branch> branches = branchRepository.findAll();
        return branches.stream()
                .filter(b -> b.getName() != null && b.getName().toLowerCase().contains("main"))
                .findFirst()
                .orElse(null);
    }

    public boolean isMainBranch(Branch b) {
        if (b == null) return false;
        return b.getName() != null && b.getName().toLowerCase().contains("main");
    }

    public boolean isMainBranch(String branchName) {
        if (branchName == null || branchName.isBlank()) return false;
        return branchName.toLowerCase().contains("main");
    }

    public java.util.Optional<Product> findById(Long id) {
        return productRepository.findById(id);
    }

    /** Find existing product by brand + model + category for auto-merge on POST. */
    public java.util.Optional<Product> findByBrandAndModelAndCategory(String brand, String model, String category) {
        List<Product> matches = productRepository.findByBrandAndModelAndCategory(brand, model, category);
        return matches.isEmpty() ? java.util.Optional.empty() : java.util.Optional.of(matches.get(0));
    }

    /** Save product fields only (no initial batch creation). Used for updates. */
    @Transactional
    public Product saveProductOnly(Product product) {
        return productRepository.save(product);
    }

    @Transactional
    public void deleteProduct(Long id) {
        productRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<Product> getAllProducts() {
        return getAllProducts(null);
    }

    @Transactional(readOnly = true)
    public List<Product> getAllProducts(Long branchId) {
        List<Product> products = productRepository.findAllWithVariants();
        if (products.isEmpty()) return products;

        // Fetch all aggregates in single batch queries — scoped to branch if provided
        Map<Long, Long> addedMap = stockBatchRepository.sumQuantityByVariantIdAndBranch(branchId).stream()
                .collect(Collectors.toMap(
                    row -> ((Number) row[0]).longValue(), 
                    row -> row[1] != null ? ((Number) row[1]).longValue() : 0L
                ));

        Map<Long, Long> soldMap = transactionRepository.countByVariantIdAndBranch(branchId).stream()
                .collect(Collectors.toMap(
                    row -> ((Number) row[0]).longValue(), 
                    row -> row[1] != null ? ((Number) row[1]).longValue() : 0L
                ));

        // Current remaining stock per variant scoped to branch
        Map<Long, Long> stockMap = stockBatchRepository.sumRemainingQuantityByVariantIdAndBranch(branchId).stream()
                .collect(Collectors.toMap(
                    row -> ((Number) row[0]).longValue(),
                    row -> row[1] != null ? ((Number) row[1]).longValue() : 0L
                ));

        Map<Long, Long> partnerStockMap = stockBatchRepository.sumPartnerRemainingQuantityByVariantIdAndBranch(branchId).stream()
                .collect(Collectors.toMap(
                    row -> ((Number) row[0]).longValue(),
                    row -> row[1] != null ? ((Number) row[1]).longValue() : 0L
                ));

        // Group remaining quantities by variant and branch
        List<Object[]> branchLocationRows = stockBatchRepository.findRemainingStockByVariantAndBranch();
        Map<String, Integer> branchVariantQtyMap = new HashMap<>();
        for (Object[] row : branchLocationRows) {
            Long vId = ((Number) row[0]).longValue();
            if (row[1] != null) {
                Long bId = ((Number) row[1]).longValue();
                int qty = ((Number) row[3]).intValue();
                branchVariantQtyMap.put(bId + "_" + vId, branchVariantQtyMap.getOrDefault(bId + "_" + vId, 0) + qty);
            }
        }

        // Group remaining quantities for holding pool (branch IS NULL)
        List<Object[]> holdingLocationRows = stockBatchRepository.findRemainingHoldingStockByVariant();
        Map<Long, Integer> holdingVariantQtyMap = new HashMap<>();
        for (Object[] row : holdingLocationRows) {
            Long vId = ((Number) row[0]).longValue();
            int qty = ((Number) row[1]).intValue();
            holdingVariantQtyMap.put(vId, qty);
        }

        List<Branch> allBranches = branchRepository.findAll().stream()
                .filter(b -> b.isActive() && (b.getName() == null || !b.getName().toLowerCase().contains("warehouse")))
                .collect(Collectors.toList());

        // Transferred quantities (units allocated/transferred to branches)
        Map<Long, Long> transferredMap = stockAdjustmentRepository.sumTransferredQuantityByVariantId().stream()
                .collect(Collectors.toMap(
                    row -> ((Number) row[0]).longValue(),
                    row -> row[1] != null ? ((Number) row[1]).longValue() : 0L
                ));

        // Actual manual adjustments (excluding branch transfers)
        Map<Long, Long> actualAdjustedMap = stockAdjustmentRepository.sumActualAdjustmentsByVariantIdAndBranch(branchId).stream()
                .collect(Collectors.toMap(
                    row -> ((Number) row[0]).longValue(),
                    row -> row[1] != null ? ((Number) row[1]).longValue() : 0L
                ));

        Map<Long, BigDecimal> branchPriceMap = branchId != null ?
                branchSellingPriceRepository.findAllByBranchId(branchId).stream()
                        .filter(bsp -> bsp.getVariant() != null && bsp.getVariant().getId() != null)
                        .collect(Collectors.toMap(
                                bsp -> bsp.getVariant().getId(),
                                BranchSellingPrice::getSellingPrice,
                                (p1, p2) -> p2
                        )) : Map.of();

        // Populate all transient fields on each variant in one pass
        for (Product product : products) {
            if (product.getVariants() != null) {
                for (ProductVariant v : product.getVariants()) {
                    int holdingStock = holdingVariantQtyMap.getOrDefault(v.getId(), 0);
                    int branchStock = 0;
                    List<Map<String, Object>> locs = new java.util.ArrayList<>();

                    // 1. Admin placeholder for unallocated items
                    Map<String, Object> holdingLoc = new LinkedHashMap<>();
                    holdingLoc.put("branchId", null);
                    holdingLoc.put("branchName", "Admin (Unallocated)");
                    holdingLoc.put("address", "Admin Holding — Unallocated Stock");
                    holdingLoc.put("quantity", holdingStock);
                    holdingLoc.put("isMain", true);
                    locs.add(holdingLoc);

                    // 2. Retail branches
                    for (Branch b : allBranches) {
                        Long bId = b.getId();
                        int qty = branchVariantQtyMap.getOrDefault(bId + "_" + v.getId(), 0);
                        branchStock += qty;

                        Map<String, Object> loc = new LinkedHashMap<>();
                        loc.put("branchId", bId);
                        loc.put("branchName", b.getName());
                        loc.put("address", b.getAddress() != null ? b.getAddress() : "");
                        loc.put("quantity", qty);
                        loc.put("isMain", false);
                        locs.add(loc);
                    }

                    v.setMainStock(holdingStock);
                    v.setBranchStock(branchStock);
                    v.setLocationBreakdown(locs);
                    v.setTotalTransferred(transferredMap.getOrDefault(v.getId(), 0L));
                    v.setTotalAdjusted(actualAdjustedMap.getOrDefault(v.getId(), 0L));
                    v.setTotalAdded(addedMap.getOrDefault(v.getId(), 0L));
                    v.setTotalSold(soldMap.getOrDefault(v.getId(), 0L));

                    // When branchId is null (Admin / Master Catalog View): total units across all locations
                    if (branchId == null) {
                        v.setStockQuantity(holdingStock + branchStock);
                    } else {
                        v.setStockQuantity(stockMap.getOrDefault(v.getId(), 0L).intValue());
                    }

                    int pStock = partnerStockMap.getOrDefault(v.getId(), 0L).intValue();
                    int totalStock = (branchId == null) ? (holdingStock + branchStock) : stockMap.getOrDefault(v.getId(), 0L).intValue();
                    v.setPartnerStock(pStock);
                    v.setOwnedStock(Math.max(0, totalStock - pStock));

                    if (branchId != null && branchPriceMap.containsKey(v.getId())) {
                        BigDecimal bp = branchPriceMap.get(v.getId());
                        v.setBranchSellingPrice(bp);
                        v.setHasCustomPrice(true);
                        v.setSellingPrice(bp);
                    }
                }
            }
        }

        // When scoped to a specific retail branch, strictly keep only products and variants
        // related to that branch (in-stock, previously allocated, or sold at this branch).
        if (branchId != null) {
            for (Product product : products) {
                if (product.getVariants() != null) {
                    product.getVariants().removeIf(v -> {
                        long bQty = stockMap.getOrDefault(v.getId(), 0L);
                        long bAdded = addedMap.getOrDefault(v.getId(), 0L);
                        long bSold = soldMap.getOrDefault(v.getId(), 0L);
                        return bQty <= 0 && bAdded <= 0 && bSold <= 0;
                    });
                }
            }
            products.removeIf(p -> p.getVariants() == null || p.getVariants().isEmpty());
        }

        return products;
    }

    @Transactional
    public Product saveProduct(Product product) {
        // Track which variants are brand-new (no ID yet) so we only create initial
        // batches for them — never for existing variants that already have stock.
        java.util.Set<Long> existingVariantIds = new java.util.HashSet<>();
        if (product.getVariants() != null) {
            for (ProductVariant v : product.getVariants()) {
                v.setProduct(product);
                if (v.getId() != null) {
                    existingVariantIds.add(v.getId());
                }
            }
        }
        Product saved = productRepository.save(product);
        
        // After saving product (and variants), create initial batch records
        // ONLY for newly-inserted variants (ones that had no ID before the save).
        if (saved.getVariants() != null) {
            for (ProductVariant v : saved.getVariants()) {
                // Skip variants that already existed — they already have their own batches.
                if (existingVariantIds.contains(v.getId())) {
                    continue;
                }
                // For new variants, use acquisitionPrice from the request as initial stock
                // (stockQuantity here would be the @Formula value which is 0 for a new variant).
                // The frontend sends initialStock in the request; we accept it if > 0.
                int initialQty = v.getStockQuantity() != null ? v.getStockQuantity() : 0;
                if (initialQty > 0) {
                    StockBatch initialBatch = new StockBatch();
                    initialBatch.setVariant(v);
                    initialBatch.setQuantity(initialQty);
                    initialBatch.setRemainingQuantity(initialQty);
                    initialBatch.setAcquisitionPrice(v.getAcquisitionPrice());
                    initialBatch.setSupplier(v.getDefaultSupplier());
                    initialBatch.setConsigned(v.isConsigned());
                    initialBatch.setBatchId("INITIAL-" + v.getSku());
                    stockBatchRepository.save(initialBatch);
                }
            }
        }
        return saved;
    }

    @Transactional
    public ProductVariant addStock(Long variantId, int quantity, BigDecimal acquisitionPrice,
                                   Long supplierId, boolean consigned) {
        return addStock(variantId, quantity, acquisitionPrice, supplierId, consigned, null, false, null, null);
    }

    @Transactional
    public ProductVariant addStock(Long variantId, int quantity, BigDecimal acquisitionPrice,
                                   Long supplierId, boolean consigned, Long branchId) {
        return addStock(variantId, quantity, acquisitionPrice, supplierId, consigned, branchId, false, null, null);
    }

    @Transactional
    public ProductVariant addStock(Long variantId, int quantity, BigDecimal acquisitionPrice,
                                   Long supplierId, boolean consigned, Long branchId,
                                   boolean partner, String partnerName, BigDecimal partnerSplitPct) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than zero.");
        }
        ProductVariant variant = variantRepository.findById(variantId)
                .orElseThrow(() -> new RuntimeException("Variant not found with id: " + variantId));

        // Resolve the supplier if provided, or fallback to variant default supplier
        Supplier supplier = null;
        if (supplierId != null) {
            supplier = supplierRepository.findById(supplierId).orElse(null);
        } else if (variant.getDefaultSupplier() != null) {
            supplier = variant.getDefaultSupplier();
        }

        if (acquisitionPrice == null) {
            acquisitionPrice = variant.getAcquisitionPrice() != null ? variant.getAcquisitionPrice() : BigDecimal.ZERO;
        }

        Branch branch = null;
        if (branchId != null) {
            branch = branchRepository.findById(branchId).orElse(null);
        }

        boolean isTransferFromHolding = (branch != null);
        if (isTransferFromHolding) {
            List<StockBatch> holdingBatches = stockBatchRepository
                    .findReceivableForHoldingForUpdate(variantId);
            int availableInHolding = holdingBatches.stream()
                    .mapToInt(b -> b.getRemainingQuantity() != null ? b.getRemainingQuantity() : 0)
                    .sum();
            if (quantity > availableInHolding) {
                String name = variant.getProduct() != null 
                    ? variant.getProduct().getBrandName() + " " + variant.getProduct().getModelName() + " (" + variant.getSku() + ")"
                    : "Variant #" + variantId;
                throw new IllegalArgumentException("Cannot add to " + branch.getName() +
                    ": Insufficient stock in Holding Pool for " + name + ". Available in Holding Pool: " + availableInHolding + ", requested: " + quantity + ".");
            }
            int remainingToDeduct = quantity;
            for (StockBatch hBatch : holdingBatches) {
                if (remainingToDeduct <= 0) break;
                int available = hBatch.getRemainingQuantity() != null ? hBatch.getRemainingQuantity() : 0;
                if (available >= remainingToDeduct) {
                    hBatch.setRemainingQuantity(available - remainingToDeduct);
                    remainingToDeduct = 0;
                } else {
                    hBatch.setRemainingQuantity(0);
                    remainingToDeduct -= available;
                }
                stockBatchRepository.save(hBatch);
            }
            StockAdjustment adj = new StockAdjustment();
            adj.setVariant(variant);
            adj.setQuantity(quantity);
            adj.setReason("Transfer to " + branch.getName());
            adj.setNote("Stock transfer to branch: " + branch.getName());
            adj.setBranch(null);
            stockAdjustmentRepository.save(adj);
        }

        StockBatch batch = new StockBatch();
        batch.setVariant(variant);
        batch.setQuantity(quantity);
        batch.setRemainingQuantity(quantity);
        batch.setAcquisitionPrice(acquisitionPrice);
        batch.setSupplier(supplier);
        batch.setConsigned(consigned);
        batch.setPartner(partner);
        batch.setPartnerName(partner ? (partnerName != null && !partnerName.isBlank() ? partnerName.trim() : "Pickle Gear") : null);
        batch.setPartnerSplitPct(partnerSplitPct != null ? partnerSplitPct : new BigDecimal("50.00"));
        batch.setBranch(branch);
        batch.setBatchId(UUID.randomUUID().toString());
        stockBatchRepository.save(batch);

        // Flush then query the true remaining stock from the DB
        entityManager.flush();
        Long currentStock;
        if (branchId != null) {
            currentStock = stockBatchRepository.sumRemainingQuantityForVariantAndBranch(variantId, branchId);
        } else {
            currentStock = stockBatchRepository.sumRemainingQuantityForVariant(variantId);
        }
        variant.setStockQuantity(currentStock != null ? currentStock.intValue() : 0);
        return variant;
    }

    @Transactional
    public ProductVariant deductStock(Long variantId, int quantity, String reason, String note) {
        return deductStock(variantId, quantity, reason, note, null);
    }

    @Transactional
    public ProductVariant deductStock(Long variantId, int quantity, String reason, String note, Long branchId) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than zero.");
        }
        ProductVariant variant = variantRepository.findById(variantId)
                .orElseThrow(() -> new RuntimeException("Variant not found with id: " + variantId));

        Branch branch = null;
        if (branchId != null) {
            branch = branchRepository.findById(branchId).orElse(null);
        }

        List<StockBatch> batches;
        if (branchId != null) {
            batches = stockBatchRepository.findReceivableByVariantIdAndBranchIdForUpdate(variantId, branchId);
        } else {
            batches = stockBatchRepository.findReceivableForHoldingForUpdate(variantId);
        }

        int actualAvailable = batches.stream()
                .mapToInt(b -> b.getRemainingQuantity() != null ? b.getRemainingQuantity() : 0)
                .sum();
        if (quantity > actualAvailable) {
            throw new IllegalArgumentException("Cannot deduct more than current stock (" + actualAvailable + ").");
        }

        // FIFO deduction across locked batches
        int remainingToDeduct = quantity;
        for (StockBatch batch : batches) {
            if (remainingToDeduct <= 0) break;
            int available = batch.getRemainingQuantity() != null ? batch.getRemainingQuantity() : 0;
            if (available >= remainingToDeduct) {
                batch.setRemainingQuantity(available - remainingToDeduct);
                remainingToDeduct = 0;
            } else {
                batch.setRemainingQuantity(0);
                remainingToDeduct -= available;
            }
            stockBatchRepository.save(batch);
        }

        // Persist the adjustment record
        StockAdjustment adj = new StockAdjustment();
        adj.setVariant(variant);
        adj.setQuantity(quantity);
        adj.setReason(reason == null || reason.isBlank() ? "Manual Adjustment" : reason);
        adj.setNote(note);
        adj.setBranch(branch);
        stockAdjustmentRepository.save(adj);

        // Flush then query the true remaining stock from the DB
        entityManager.flush();
        Long currentStock;
        if (branchId != null) {
            currentStock = stockBatchRepository.sumRemainingQuantityForVariantAndBranch(variantId, branchId);
        } else {
            currentStock = stockBatchRepository.sumRemainingQuantityForVariant(variantId);
        }
        variant.setStockQuantity(currentStock != null ? currentStock.intValue() : 0);
        return variant;
    }

    /** Partial edit of a variant — only non-null fields are applied. */
    @Transactional
    public ProductVariant updateVariant(Long variantId, ProductVariant patch) {
        ProductVariant existing = variantRepository.findById(variantId)
                .orElseThrow(() -> new RuntimeException("Variant not found with id: " + variantId));

        if (patch.getSku() != null && !patch.getSku().isBlank()) existing.setSku(patch.getSku().trim());
        if (patch.getColor() != null)            existing.setColor(patch.getColor());
        if (patch.getThicknessMm() != null)      existing.setThicknessMm(patch.getThicknessMm());
        if (patch.getShape() != null)            existing.setShape(patch.getShape());
        if (patch.getAcquisitionPrice() != null) existing.setAcquisitionPrice(patch.getAcquisitionPrice());
        if (patch.getSellingPrice() != null)     existing.setSellingPrice(patch.getSellingPrice());
        if (patch.getLowStockThreshold() != null) existing.setLowStockThreshold(patch.getLowStockThreshold());
        // Boolean is primitive, so always carries a value — only treat the request's value as authoritative
        // when the JSON actually carried supplier or ownership info. The patch object is built from JSON
        // so consigned will reflect the submitted value; we accept it.
        existing.setConsigned(patch.isConsigned());

        // Supplier replacement: accept null (clear) or a {id} reference
        if (patch.getDefaultSupplier() != null && patch.getDefaultSupplier().getId() != null) {
            Supplier s = supplierRepository.findById(patch.getDefaultSupplier().getId()).orElse(null);
            existing.setDefaultSupplier(s);
        }
        return variantRepository.save(existing);
    }

    @Transactional
    public void deleteVariant(Long variantId) {
        ProductVariant variant = variantRepository.findById(variantId)
                .orElseThrow(() -> new RuntimeException("Variant not found with id: " + variantId));
        variantRepository.delete(variant);
    }

    public List<StockAdjustment> getAdjustments(Long variantId) {
        return stockAdjustmentRepository.findByVariantIdOrderByAdjustedAtDesc(variantId);
    }

    public List<StockAdjustment> getAdjustments(Long variantId, Long branchId) {
        return stockAdjustmentRepository.findByVariantIdAndBranchOrderByAdjustedAtDesc(variantId, branchId);
    }
}