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
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    public Branch getMainBranch() {
        List<Branch> branches = branchRepository.findAll();
        return branches.stream()
                .filter(b -> b.getName() != null && b.getName().toLowerCase().contains("main"))
                .findFirst()
                .orElseGet(() -> branches.stream()
                        .filter(b -> b.getId() != null && b.getId() == 1L)
                        .findFirst()
                        .orElseGet(() -> branches.isEmpty() ? null : branches.get(0)));
    }

    public boolean isMainBranch(Branch b) {
        if (b == null) return true;
        if (b.getName() != null && b.getName().toLowerCase().contains("main")) return true;
        Branch main = getMainBranch();
        return main != null && b.getId() != null && b.getId().equals(main.getId());
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

        // Current remaining stock per variant
        Map<Long, Long> stockMap = stockBatchRepository.sumRemainingQuantityByVariantIdAndBranch(branchId).stream()
                .collect(Collectors.toMap(
                    row -> ((Number) row[0]).longValue(),
                    row -> row[1] != null ? ((Number) row[1]).longValue() : 0L
                ));

        // Total units removed via manual adjustments
        Map<Long, Long> adjustedMap = stockAdjustmentRepository.sumQuantityByVariantIdAndBranch(branchId).stream()
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
                    v.setTotalAdded(addedMap.getOrDefault(v.getId(), 0L));
                    v.setTotalSold(soldMap.getOrDefault(v.getId(), 0L));
                    v.setTotalAdjusted(adjustedMap.getOrDefault(v.getId(), 0L));
                    v.setStockQuantity(stockMap.getOrDefault(v.getId(), 0L).intValue());
                    if (branchId != null && branchPriceMap.containsKey(v.getId())) {
                        BigDecimal bp = branchPriceMap.get(v.getId());
                        v.setBranchSellingPrice(bp);
                        v.setHasCustomPrice(true);
                        v.setSellingPrice(bp);
                    }
                }
            }
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
        return addStock(variantId, quantity, acquisitionPrice, supplierId, consigned, null);
    }

    @Transactional
    public ProductVariant addStock(Long variantId, int quantity, BigDecimal acquisitionPrice,
                                   Long supplierId, boolean consigned, Long branchId) {
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

        Branch mainBranch = getMainBranch();
        boolean isTransferFromMain = (branch != null && !isMainBranch(branch));
        if (isTransferFromMain) {
            Long mainBranchId = mainBranch != null ? mainBranch.getId() : 1L;
            List<StockBatch> mainBatches = stockBatchRepository
                    .findReceivableForMainForUpdate(variantId, mainBranchId);
            int availableInMain = mainBatches.stream()
                    .mapToInt(b -> b.getRemainingQuantity() != null ? b.getRemainingQuantity() : 0)
                    .sum();
            if (quantity > availableInMain) {
                String name = variant.getProduct() != null 
                    ? variant.getProduct().getBrandName() + " " + variant.getProduct().getModelName() + " (" + variant.getSku() + ")"
                    : "Variant #" + variantId;
                throw new IllegalArgumentException("Cannot add to " + branch.getName() +
                    ": Insufficient stock in Main Inventory for " + name + ". Available in Main: " + availableInMain + ", requested: " + quantity + ".");
            }
            int remainingToDeduct = quantity;
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
            StockAdjustment adj = new StockAdjustment();
            adj.setVariant(variant);
            adj.setQuantity(quantity);
            adj.setReason("Transfer to " + branch.getName());
            adj.setNote("Stock transfer to branch: " + branch.getName());
            adj.setBranch(mainBranch);
            stockAdjustmentRepository.save(adj);
        }

        StockBatch batch = new StockBatch();
        batch.setVariant(variant);
        batch.setQuantity(quantity);
        batch.setRemainingQuantity(quantity);
        batch.setAcquisitionPrice(acquisitionPrice);
        batch.setSupplier(supplier);
        batch.setConsigned(consigned);
        batch.setBranch(branch);
        batch.setBatchId(UUID.randomUUID().toString());
        stockBatchRepository.save(batch);

        // Flush then query the true remaining stock from the DB
        entityManager.flush();
        Long currentStock = stockBatchRepository.sumRemainingQuantityForVariantAndBranch(variantId, branchId);
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

        List<StockBatch> batches = stockBatchRepository
            .findReceivableByVariantIdAndBranchIdForUpdate(variantId, branchId);

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
        Long currentStock = stockBatchRepository.sumRemainingQuantityForVariantAndBranch(variantId, branchId);
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