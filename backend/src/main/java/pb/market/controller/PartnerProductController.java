package pb.market.controller;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import pb.market.config.StockWebSocketHandler;
import pb.market.config.UserPrincipal;
import pb.market.entity.*;
import pb.market.repository.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/partner-products")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PartnerProductController {

    private final StockBatchRepository stockBatchRepository;
    private final VariantRepository variantRepository;
    private final ProductRepository productRepository;
    private final BranchRepository branchRepository;
    private final StockWebSocketHandler stockWebSocketHandler;

    @Data
    public static class PartnerIntakeItem {
        private Long variantId;
        private Integer quantity;
        private BigDecimal acquisitionPrice;
        private BigDecimal sellingPrice;
    }

    @Data
    public static class PartnerIntakeRequest {
        private String partnerName;
        private BigDecimal partnerSplitPct;
        private Long branchId;
        private String notes;
        private List<PartnerIntakeItem> items;

        // Single-item fallback fields
        private Long variantId;
        private Integer quantity;
        private BigDecimal acquisitionPrice;
        private BigDecimal sellingPrice;
    }

    @Data
    public static class QuickCreatePartnerRequest {
        private String brandName;
        private String modelName;
        private String category;
        private String color;
        private Integer thicknessMm;
        private String shape;
        private BigDecimal sellingPrice;
        private BigDecimal acquisitionPrice;
        private Integer quantity;
        private String partnerName;
        private BigDecimal partnerSplitPct;
        private Long branchId;
        private String notes;
    }

    /**
     * GET /api/partner-products
     * Returns active partner inventory batches / products.
     * Scoped to branch if authenticated as a branch user.
     */
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> getPartnerProducts(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) String partnerName,
            @org.springframework.security.core.annotation.AuthenticationPrincipal UserPrincipal user) {

        Long resolvedBranchId = branchId;
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            resolvedBranchId = user.getBranchId();
        }

        List<StockBatch> partnerBatches = stockBatchRepository.findAllPartnerBatchesWithDetails();

        final Long filterBranchId = resolvedBranchId;
        final String filterPartner = (partnerName != null && !partnerName.isBlank() && !"ALL".equalsIgnoreCase(partnerName))
                ? partnerName.trim().toLowerCase() : null;

        List<Map<String, Object>> result = partnerBatches.stream()
                .filter(b -> {
                    if (filterBranchId != null) {
                        if (b.getBranch() == null || !filterBranchId.equals(b.getBranch().getId())) {
                            return false;
                        }
                    }
                    if (filterPartner != null) {
                        if (b.getPartnerName() == null || !b.getPartnerName().toLowerCase().contains(filterPartner)) {
                            return false;
                        }
                    }
                    return b.getRemainingQuantity() != null && b.getRemainingQuantity() > 0;
                })
                .map(b -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    ProductVariant v = b.getVariant();
                    Product p = v != null ? v.getProduct() : null;

                    map.put("batchId", b.getBatchId());
                    map.put("variantId", v != null ? v.getId() : null);
                    map.put("sku", v != null ? v.getSku() : "");
                    map.put("brandName", p != null ? p.getBrandName() : "");
                    map.put("modelName", p != null ? p.getModelName() : "");
                    map.put("category", p != null ? p.getCategory() : "Paddles");
                    map.put("color", v != null ? v.getColor() : "");
                    map.put("thicknessMm", v != null ? v.getThicknessMm() : null);
                    map.put("shape", v != null ? v.getShape() : "");
                    map.put("variantSpecs", v != null ? ((v.getThicknessMm() != null ? v.getThicknessMm() + "mm " : "") + (v.getShape() != null ? v.getShape() : "")).trim() : "");
                    map.put("quantity", b.getQuantity());
                    map.put("remainingQuantity", b.getRemainingQuantity());
                    map.put("acquisitionPrice", b.getAcquisitionPrice());
                    map.put("sellingPrice", v != null ? v.getSellingPrice() : BigDecimal.ZERO);
                    map.put("partnerName", b.getPartnerName() != null ? b.getPartnerName() : "Partner");
                    map.put("partnerSplitPct", b.getPartnerSplitPct() != null ? b.getPartnerSplitPct() : new BigDecimal("50.00"));
                    map.put("branchId", b.getBranch() != null ? b.getBranch().getId() : null);
                    map.put("branchName", b.getBranch() != null ? b.getBranch().getName() : "Central Master Admin");
                    map.put("restockedAt", b.getRestockedAt());
                    map.put("notes", "Partner batch #" + (b.getBatchId() != null ? b.getBatchId() : "-"));
                    return map;
                })
                .sorted((a, b) -> {
                    LocalDateTime dtA = (LocalDateTime) a.get("restockedAt");
                    LocalDateTime dtB = (LocalDateTime) b.get("restockedAt");
                    if (dtA == null) return 1;
                    if (dtB == null) return -1;
                    return dtB.compareTo(dtA);
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/partner-products/intake
     * Direct intake for partner items.
     * Directly adds stock to the target branch inventory without going through Admin Holding Pool!
     */
    @PostMapping("/intake")
    @Transactional
    public ResponseEntity<?> intakePartnerStock(
            @RequestBody PartnerIntakeRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal UserPrincipal user) {

        String partnerName = (request.getPartnerName() != null && !request.getPartnerName().isBlank())
                ? request.getPartnerName().trim() : "Uly";
        BigDecimal splitPct = request.getPartnerSplitPct() != null
                ? request.getPartnerSplitPct() : new BigDecimal("50.00");

        // Determine destination branch
        Long targetBranchId = request.getBranchId();
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            targetBranchId = user.getBranchId();
        }

        Branch branch = null;
        if (targetBranchId != null && targetBranchId > 0) {
            branch = branchRepository.findById(targetBranchId).orElse(null);
        }

        // Collect items from array or fallback
        List<PartnerIntakeItem> items = request.getItems();
        if (items == null || items.isEmpty()) {
            if (request.getVariantId() != null && request.getQuantity() != null && request.getQuantity() > 0) {
                PartnerIntakeItem single = new PartnerIntakeItem();
                single.setVariantId(request.getVariantId());
                single.setQuantity(request.getQuantity());
                single.setAcquisitionPrice(request.getAcquisitionPrice());
                single.setSellingPrice(request.getSellingPrice());
                items = List.of(single);
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "At least one item with valid quantity is required."));
            }
        }

        int totalUnits = 0;
        List<StockBatch> createdBatches = new ArrayList<>();

        for (PartnerIntakeItem item : items) {
            if (item.getVariantId() == null || item.getQuantity() == null || item.getQuantity() <= 0) {
                continue;
            }

            ProductVariant variant = variantRepository.findById(item.getVariantId())
                    .orElseThrow(() -> new IllegalArgumentException("Variant not found: " + item.getVariantId()));

            // Ensure partner flag and partner name are marked on variant
            variant.setPartner(true);
            variant.setPartnerName(partnerName);
            variant.setPartnerSplitPct(splitPct);

            if (item.getSellingPrice() != null && item.getSellingPrice().compareTo(BigDecimal.ZERO) > 0) {
                variant.setSellingPrice(item.getSellingPrice());
            }
            variantRepository.save(variant);

            BigDecimal acqPrice = item.getAcquisitionPrice() != null
                    ? item.getAcquisitionPrice()
                    : (variant.getAcquisitionPrice() != null ? variant.getAcquisitionPrice() : BigDecimal.ZERO);

            StockBatch batch = new StockBatch();
            batch.setVariant(variant);
            batch.setQuantity(item.getQuantity());
            batch.setRemainingQuantity(item.getQuantity());
            batch.setAcquisitionPrice(acqPrice);
            batch.setPartner(true);
            batch.setPartnerName(partnerName);
            batch.setPartnerSplitPct(splitPct);
            batch.setBranch(branch);
            batch.setStatus("RECEIVED");
            batch.setBatchId("PARTNER-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
            // notes omitted
            batch.setRestockedAt(LocalDateTime.now());

            createdBatches.add(stockBatchRepository.save(batch));
            totalUnits += item.getQuantity();
        }

        stockWebSocketHandler.broadcastStockUpdate();

        String destinationName = branch != null ? branch.getName() : "Central Master Admin";
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", String.format("Successfully received %d partner unit(s) from %s into %s!", totalUnits, partnerName, destinationName),
                "totalUnits", totalUnits,
                "partnerName", partnerName,
                "partnerSplitPct", splitPct,
                "destination", destinationName,
                "batchCount", createdBatches.size()
        ));
    }

    /**
     * POST /api/partner-products/quick-create
     * Fast-create a new partner product & variant and intake stock directly.
     */
    @PostMapping("/quick-create")
    @Transactional
    public ResponseEntity<?> quickCreateAndIntake(
            @RequestBody QuickCreatePartnerRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal UserPrincipal user) {

        if (request.getBrandName() == null || request.getBrandName().isBlank() ||
            request.getModelName() == null || request.getModelName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Brand and model name are required."));
        }
        if (request.getQuantity() == null || request.getQuantity() <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Quantity must be greater than 0."));
        }

        String partnerName = (request.getPartnerName() != null && !request.getPartnerName().isBlank())
                ? request.getPartnerName().trim() : "Uly";
        BigDecimal splitPct = request.getPartnerSplitPct() != null
                ? request.getPartnerSplitPct() : new BigDecimal("50.00");

        Long targetBranchId = request.getBranchId();
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            targetBranchId = user.getBranchId();
        }
        Branch branch = null;
        if (targetBranchId != null && targetBranchId > 0) {
            branch = branchRepository.findById(targetBranchId).orElse(null);
        }

        String brand = request.getBrandName().trim();
        String model = request.getModelName().trim();
        String category = (request.getCategory() != null && !request.getCategory().isBlank())
                ? request.getCategory().trim() : "Paddles";

        // Find or create product
        Product product = productRepository.findFirstByBrandNameIgnoreCaseAndModelNameIgnoreCase(brand, model)
                .orElseGet(() -> {
                    Product p = new Product();
                    p.setBrandName(brand);
                    p.setModelName(model);
                    p.setCategory(category);
                    return productRepository.save(p);
                });

        // Generate SKU
        String sku = generateSku(brand, model, request.getColor(), request.getThicknessMm());

        ProductVariant variant = new ProductVariant();
        variant.setProduct(product);
        variant.setSku(sku);
        variant.setColor(request.getColor() != null && !request.getColor().isBlank() ? request.getColor().trim() : "Standard");
        variant.setThicknessMm(request.getThicknessMm() != null ? request.getThicknessMm() : 16);
        variant.setShape(request.getShape() != null ? request.getShape().trim() : "Standard");
        variant.setSellingPrice(request.getSellingPrice() != null ? request.getSellingPrice() : BigDecimal.ZERO);
        variant.setAcquisitionPrice(request.getAcquisitionPrice() != null ? request.getAcquisitionPrice() : BigDecimal.ZERO);
        variant.setPartner(true);
        variant.setPartnerName(partnerName);
        variant.setPartnerSplitPct(splitPct);
        variantRepository.save(variant);

        // Intake StockBatch directly
        StockBatch batch = new StockBatch();
        batch.setVariant(variant);
        batch.setQuantity(request.getQuantity());
        batch.setRemainingQuantity(request.getQuantity());
        batch.setAcquisitionPrice(variant.getAcquisitionPrice());
        batch.setPartner(true);
        batch.setPartnerName(partnerName);
        batch.setPartnerSplitPct(splitPct);
        batch.setBranch(branch);
        batch.setStatus("RECEIVED");
        batch.setBatchId("PARTNER-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        // notes omitted
        batch.setRestockedAt(LocalDateTime.now());
        stockBatchRepository.save(batch);

        stockWebSocketHandler.broadcastStockUpdate();

        String destinationName = branch != null ? branch.getName() : "Central Master Admin";
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", String.format("Successfully created and received %d unit(s) of %s %s from %s into %s!",
                        request.getQuantity(), brand, model, partnerName, destinationName),
                "sku", sku,
                "variantId", variant.getId(),
                "partnerName", partnerName,
                "quantity", request.getQuantity(),
                "destination", destinationName
        ));
    }

    private String generateSku(String brand, String model, String color, Integer thickness) {
        String b = brand.replaceAll("[^a-zA-Z0-9]", "").toUpperCase();
        String m = model.replaceAll("[^a-zA-Z0-9]", "").toUpperCase();
        String c = (color != null && !color.isBlank() && !"Standard".equalsIgnoreCase(color))
                ? "-" + color.replaceAll("[^a-zA-Z0-9]", "").toUpperCase().substring(0, Math.min(3, color.length()))
                : "";
        String t = (thickness != null && thickness > 0) ? "-" + thickness : "";
        String prefix = (b.length() >= 3 ? b.substring(0, 3) : b) + "-" + (m.length() >= 3 ? m.substring(0, 3) : m) + c + t;
        String candidate = prefix;
        int counter = 1;
        while (variantRepository.findBySku(candidate).isPresent()) {
            candidate = prefix + "-" + counter;
            counter++;
        }
        return candidate;
    }
}
