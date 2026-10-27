package pb.market.controller;

import pb.market.entity.Branch;
import pb.market.entity.BranchSellingPrice;
import pb.market.entity.Product;
import pb.market.entity.ProductVariant;
import pb.market.entity.StockAdjustment;
import pb.market.config.StockWebSocketHandler;
import pb.market.config.UserPrincipal;
import pb.market.repository.BranchRepository;
import pb.market.repository.BranchSellingPriceRepository;
import pb.market.repository.VariantRepository;
import pb.market.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {
    private final ProductService productService;
    private final pb.market.repository.TransactionRepository transactionRepository;
    private final StockWebSocketHandler stockWebSocketHandler;
    private final BranchSellingPriceRepository branchSellingPriceRepository;
    private final BranchRepository branchRepository;
    private final VariantRepository variantRepository;

    @GetMapping
    public List<Product> getAll(
            @RequestParam(required = false) Long branchId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (user != null && "BRANCH".equals(user.getRole())) {
            branchId = user.getBranchId();
        }
        return productService.getAllProducts(branchId);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody Product product) {
        if (product.getBrandName() == null || product.getBrandName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Brand name is required."));
        }
        if (product.getModelName() == null || product.getModelName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Model name is required."));
        }
        if (product.getVariants() == null || product.getVariants().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "At least one variant is required."));
        }

        // Auto-fill blank SKUs server-side
        String brandSlug = product.getBrandName().trim().toUpperCase().replaceAll("[^A-Z0-9]+", "");
        if (brandSlug.length() > 6) brandSlug = brandSlug.substring(0, 6);
        final String slug = brandSlug;
        for (ProductVariant v : product.getVariants()) {
            if (v.getSku() == null || v.getSku().isBlank()) {
                v.setSku(slug + "-" + System.currentTimeMillis() + "-" + Math.abs(v.hashCode() % 1000));
            }
        }

        // ── AUTO-MERGE: if a product with the same brand+model+category already exists,
        // append the new variants to it instead of creating a duplicate product.
        // This applies to ALL categories so that adding sizes to Shoes, or a new
        // color to an existing Paddle model, just adds variants rather than a new row.
        var existing = productService.findByBrandAndModelAndCategory(
            product.getBrandName().trim(),
            product.getModelName().trim(),
            product.getCategory()
        );

        if (existing.isPresent()) {
            Product existingProduct = existing.get();
            // Collect existing SKUs so we don't add duplicates
            java.util.Set<String> existingSkus = existingProduct.getVariants().stream()
                .map(v -> v.getSku() != null ? v.getSku().toLowerCase() : "")
                .collect(java.util.stream.Collectors.toSet());

            int added = 0;
            for (ProductVariant newVariant : product.getVariants()) {
                String newSku = newVariant.getSku() != null ? newVariant.getSku().toLowerCase() : "";
                if (existingSkus.contains(newSku)) {
                    // SKU already exists in this product — skip to avoid duplicate
                    continue;
                }
                newVariant.setProduct(existingProduct);
                existingProduct.getVariants().add(newVariant);
                added++;
            }

            if (added == 0) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "All submitted SKUs already exist in '" + existingProduct.getBrandName() + " " + existingProduct.getModelName() + "'. No new variants were added."
                ));
            }

            Product saved = productService.saveProduct(existingProduct);
            Map<String, Object> result = new java.util.LinkedHashMap<>();
            result.put("merged", true);
            result.put("productId", saved.getId());
            result.put("message", added + " new variant" + (added > 1 ? "s" : "") + " added to existing '" + saved.getBrandName() + " " + saved.getModelName() + "'.");
            result.put("totalVariants", saved.getVariants().size());
            return ResponseEntity.ok(result);
        }

        // No existing product found — create a fresh one as before
        return ResponseEntity.ok(productService.saveProduct(product));
    }

    @PostMapping("/bulk")
    public List<Product> createMultipleProducts(@RequestBody List<Product> products) {
        return products.stream()
                .map(productService::saveProduct)
                .toList();
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> update(@PathVariable("id") Long id, @RequestBody Product update) {
        return productService.findById(id).map(existing -> {
            if (update.getBrandName() != null) existing.setBrandName(update.getBrandName());
            if (update.getModelName() != null) existing.setModelName(update.getModelName());
            if (update.getCategory() != null) existing.setCategory(update.getCategory());
            return ResponseEntity.ok(productService.saveProductOnly(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable("id") Long id) {
        var productOpt = productService.findById(id);
        if (productOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Product product = productOpt.get();
        // Refuse if any variant has transactions. existsByVariantId avoids loading the full transaction list.
        if (product.getVariants() != null) {
            for (ProductVariant v : product.getVariants()) {
                if (transactionRepository.existsByVariantId(v.getId())) {
                    return ResponseEntity.badRequest().body(Map.of(
                        "error", "Cannot delete product: variant '" + v.getSku() + "' has existing transactions."
                    ));
                }
            }
        }
        productService.deleteProduct(id);
        return ResponseEntity.ok(Map.of("message", "Product deleted successfully."));
    }

    // ===== Variant CRUD =====

    /** Edit any subset of variant fields. Send only the keys you want to change. */
    @PutMapping("/variants/{id}")
    public ResponseEntity<?> updateVariant(@PathVariable("id") Long id, @RequestBody ProductVariant patch) {
        try {
            ProductVariant saved = productService.updateVariant(id, patch);
            Map<String, Object> body = new HashMap<>();
            body.put("id", saved.getId());
            body.put("sku", saved.getSku());
            body.put("color", saved.getColor());
            body.put("thicknessMm", saved.getThicknessMm());
            body.put("shape", saved.getShape());
            body.put("acquisitionPrice", saved.getAcquisitionPrice());
            body.put("sellingPrice", saved.getSellingPrice());
            body.put("consigned", saved.isConsigned());
            body.put("lowStockThreshold", saved.getLowStockThreshold());
            body.put("message", "Variant updated successfully");
            return ResponseEntity.ok(body);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Delete a single variant. Refuses if the variant has any sales. */
    @DeleteMapping("/variants/{id}")
    @Transactional
    public ResponseEntity<?> deleteVariant(@PathVariable("id") Long id) {
        if (transactionRepository.existsByVariantId(id)) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Cannot delete variant: it has existing transactions. Adjust stock or hide it instead."
            ));
        }
        try {
            productService.deleteVariant(id);
            return ResponseEntity.ok(Map.of("message", "Variant deleted successfully."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Recent manual stock adjustments for one variant (used in the View Batches modal). */
    @GetMapping("/variants/{id}/adjustments")
    public List<StockAdjustment> getAdjustments(
            @PathVariable("id") Long id,
            @RequestParam(required = false) Long branchId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (user != null && "BRANCH".equals(user.getRole())) {
            branchId = user.getBranchId();
        }
        return productService.getAdjustments(id, branchId);
    }

    @PatchMapping("/variants/{id}/add-stock")
    public ResponseEntity<?> addStock(
            @PathVariable("id") Long id,
            @RequestParam int quantity,
            @RequestParam(required = false) BigDecimal acquisitionPrice,
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false, defaultValue = "false") boolean consigned,
            @RequestParam(required = false) Long branchId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        try {
            if (user != null && "BRANCH".equals(user.getRole())) {
                branchId = user.getBranchId();
            }
            ProductVariant updated = productService.addStock(id, quantity, acquisitionPrice, supplierId, consigned, branchId);
            stockWebSocketHandler.broadcastStockUpdate();
            return ResponseEntity.ok(Map.of(
                "id", updated.getId(),
                "sku", updated.getSku(),
                "stockQuantity", updated.getStockQuantity(),
                "message", "Stock updated successfully"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/variants/{id}/deduct-stock")
    public ResponseEntity<Map<String, Object>> deductStock(
            @PathVariable("id") Long id,
            @RequestParam int quantity,
            @RequestParam(required = false) String reason,
            @RequestParam(required = false) String note,
            @RequestParam(required = false) Long branchId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        try {
            if (user != null && "BRANCH".equals(user.getRole())) {
                branchId = user.getBranchId();
            }
            ProductVariant variant = productService.deductStock(id, quantity, reason, note, branchId);
            stockWebSocketHandler.broadcastStockUpdate();
            return ResponseEntity.ok(Map.of(
                "id", variant.getId(),
                "sku", variant.getSku(),
                "stockQuantity", variant.getStockQuantity(),
                "message", "Stock deducted successfully"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ===== Branch Selling Price Endpoints =====

    /**
     * Branch sets their own selling price for a specific variant.
     * Body: { "sellingPrice": 1500 }
     */
    @PutMapping("/variants/{id}/branch-price")
    @Transactional
    public ResponseEntity<?> setBranchPrice(
            @PathVariable("id") Long variantId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal user) {

        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated."));
        }

        Long branchId = null;
        if ("BRANCH".equals(user.getRole()) && user.getBranchId() != null) {
            branchId = user.getBranchId();
        }

        if (branchId == null && body != null && body.containsKey("branchId") && body.get("branchId") != null) {
            Object rawBranch = body.get("branchId");
            try {
                if (rawBranch instanceof Number) {
                    branchId = ((Number) rawBranch).longValue();
                } else {
                    String bStr = rawBranch.toString().trim();
                    if (!bStr.isEmpty() && !"null".equalsIgnoreCase(bStr) && !"undefined".equalsIgnoreCase(bStr)) {
                        branchId = Long.valueOf(bStr);
                    }
                }
            } catch (NumberFormatException ignored) {}
        }

        // If branchId is still null, default to first active branch (or first branch in system)
        if (branchId == null) {
            branchId = branchRepository.findAll().stream()
                    .filter(Branch::isActive)
                    .map(Branch::getId)
                    .findFirst()
                    .orElseGet(() -> branchRepository.findAll().stream()
                            .map(Branch::getId)
                            .findFirst()
                            .orElse(null));
        }

        if (branchId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "No active branch found."));
        }

        Branch branch = branchRepository.findById(branchId).orElse(null);
        if (branch == null) {
            branch = branchRepository.findAll().stream()
                    .filter(Branch::isActive)
                    .findFirst()
                    .orElseGet(() -> branchRepository.findAll().stream().findFirst().orElse(null));
        }
        if (branch == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Branch not found: " + branchId));
        }
        branchId = branch.getId();

        Object priceObj = body != null ? body.get("sellingPrice") : null;
        if (priceObj == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "sellingPrice is required."));
        }
        BigDecimal price;
        try {
            price = new BigDecimal(priceObj.toString().replace(",", "").trim());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid sellingPrice value."));
        }
        if (price.compareTo(BigDecimal.ZERO) < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "sellingPrice must be >= 0."));
        }

        ProductVariant variant = variantRepository.findById(variantId).orElse(null);
        if (variant == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Product variant not found: " + variantId));
        }

        final Long effectiveBranchId = branchId;
        final Branch effectiveBranch = branch;
        BranchSellingPrice bsp = branchSellingPriceRepository
                .findByBranchIdAndVariantId(effectiveBranchId, variantId)
                .orElseGet(() -> {
                    BranchSellingPrice newBsp = new BranchSellingPrice();
                    newBsp.setBranch(effectiveBranch);
                    newBsp.setVariant(variant);
                    return newBsp;
                });
        bsp.setSellingPrice(price);
        BranchSellingPrice saved = branchSellingPriceRepository.save(bsp);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("id", saved.getId());
        resp.put("variantId", variantId);
        resp.put("branchId", effectiveBranchId);
        resp.put("branchName", effectiveBranch.getName());
        resp.put("sellingPrice", price);
        resp.put("message", "Branch selling price updated.");
        return ResponseEntity.ok(resp);
    }

    /**
     * Returns all branch selling price overrides for a branch.
     * Branch users always see their own; admin can pass branchId param.
     */
    @GetMapping("/branch-prices")
    public ResponseEntity<?> getBranchPrices(
            @RequestParam(required = false) Long branchId,
            @AuthenticationPrincipal UserPrincipal user) {

        Long effectiveBranchId = (user != null && "BRANCH".equals(user.getRole()))
                ? user.getBranchId() : branchId;

        if (effectiveBranchId == null) {
            effectiveBranchId = branchRepository.findAll().stream()
                    .filter(Branch::isActive)
                    .map(Branch::getId)
                    .findFirst()
                    .orElseGet(() -> branchRepository.findAll().stream()
                            .map(Branch::getId)
                            .findFirst()
                            .orElse(null));
        }

        if (effectiveBranchId == null) {
            return ResponseEntity.ok(List.of());
        }

        List<BranchSellingPrice> prices = branchSellingPriceRepository.findAllByBranchId(effectiveBranchId);
        List<Map<String, Object>> result = prices.stream().map(bsp -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", bsp.getId());
            m.put("variantId", bsp.getVariant() != null ? bsp.getVariant().getId() : null);
            m.put("sku", bsp.getVariant() != null ? bsp.getVariant().getSku() : null);
            m.put("sellingPrice", bsp.getSellingPrice());
            m.put("updatedAt", bsp.getUpdatedAt() != null ? bsp.getUpdatedAt().toString() : null);
            return m;
        }).toList();

        return ResponseEntity.ok(result);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDuplicateKey(DataIntegrityViolationException ex) {
        String message = "A product variant with this SKU already exists.";
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", message));
    }
}
