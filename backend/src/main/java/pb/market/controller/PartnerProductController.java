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
import java.math.RoundingMode;
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
    private final PartnerRepository partnerRepository;
    private final TransactionRepository transactionRepository;
    private final StockWebSocketHandler stockWebSocketHandler;

    @Data
    public static class PartnerIntakeItem {
        private Long variantId;
        private Integer quantity;
        private BigDecimal acquisitionPrice;        // Cost price
        private BigDecimal recommendedSellingPrice; // SRP / Suggested Retail Price
        private BigDecimal sellingPrice;            // Actual selling price
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
        private BigDecimal recommendedSellingPrice;
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
        private BigDecimal acquisitionPrice;        // Cost
        private BigDecimal recommendedSellingPrice; // SRP
        private BigDecimal sellingPrice;            // Retail price
        private Integer quantity;
        private String partnerName;
        private BigDecimal partnerSplitPct;
        private Long branchId;
        private String notes;
    }

    @Data
    public static class PartnerDto {
        private Long id;
        private String name;
        private String contactInfo;
        private BigDecimal defaultSplitPct;
        private String notes;
    }

    // =========================================================================
    // PARTNER CRUD (Add Partners & Partner List)
    // =========================================================================

    @GetMapping("/partners")
    @Transactional
    public ResponseEntity<?> getPartners() {
        List<Partner> list = partnerRepository.findByArchivedFalseOrderByNameAsc();

        // If no partners exist in DB yet, auto-seed from existing stock batches so nothing is lost
        if (list.isEmpty()) {
            List<StockBatch> batches = stockBatchRepository.findAllPartnerBatchesWithDetails();
            Set<String> distinctNames = new LinkedHashSet<>();
            for (StockBatch b : batches) {
                if (b.getPartnerName() != null && !b.getPartnerName().isBlank()) {
                    distinctNames.add(b.getPartnerName().trim());
                }
            }
            for (String name : distinctNames) {
                Partner p = new Partner();
                p.setName(name);
                p.setDefaultSplitPct(new BigDecimal("50.00"));
                partnerRepository.save(p);
            }
            list = partnerRepository.findByArchivedFalseOrderByNameAsc();
        }

        return ResponseEntity.ok(list);
    }

    @PostMapping("/partners")
    @Transactional
    public ResponseEntity<?> savePartner(@RequestBody PartnerDto dto) {
        if (dto.getName() == null || dto.getName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Partner name is required."));
        }

        String name = dto.getName().trim();
        Partner partner = null;
        if (dto.getId() != null) {
            partner = partnerRepository.findById(dto.getId()).orElse(null);
        }
        if (partner == null) {
            partner = partnerRepository.findByNameIgnoreCase(name).orElse(new Partner());
        }

        partner.setName(name);
        partner.setContactInfo(dto.getContactInfo());
        partner.setDefaultSplitPct(dto.getDefaultSplitPct() != null ? dto.getDefaultSplitPct() : new BigDecimal("50.00"));
        partner.setNotes(dto.getNotes());
        partner.setArchived(false);

        Partner saved = partnerRepository.save(partner);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/partners/{id}")
    @Transactional
    public ResponseEntity<?> deletePartner(@PathVariable Long id) {
        Partner p = partnerRepository.findById(id).orElse(null);
        if (p != null) {
            p.setArchived(true);
            partnerRepository.save(p);
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Partner archived successfully."));
    }

    // =========================================================================
    // PARTNER PROFITS & SALES ANALYTICS
    // =========================================================================

    @GetMapping("/profits")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getPartnerProfits(
            @RequestParam(required = false) String partnerName,
            @RequestParam(required = false) Long branchId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal UserPrincipal user) {

        Long resolvedBranchId = branchId;
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            resolvedBranchId = user.getBranchId();
        }

        org.springframework.data.domain.Pageable page = org.springframework.data.domain.PageRequest.of(0, 10000);
        List<Transaction> txs = transactionRepository.findAllPartnerWithDetails(page);

        final Long filterBranch = resolvedBranchId;
        final String filterPartner = (partnerName != null && !partnerName.isBlank() && !"ALL".equalsIgnoreCase(partnerName))
                ? partnerName.trim().toLowerCase() : null;

        BigDecimal totalGrossRevenue = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalGrossProfit = BigDecimal.ZERO;
        BigDecimal totalPartnerShare = BigDecimal.ZERO;
        BigDecimal totalCpmShare = BigDecimal.ZERO;
        BigDecimal totalSettledPartnerShare = BigDecimal.ZERO;
        BigDecimal totalUnsettledPartnerShare = BigDecimal.ZERO;
        int totalUnitsSold = 0;

        Map<String, Map<String, Object>> partnerBreakdown = new LinkedHashMap<>();
        List<Map<String, Object>> salesLedger = new ArrayList<>();

        for (Transaction t : txs) {
            if ("UNPAID".equalsIgnoreCase(t.getStatus())) continue;

            if (filterBranch != null) {
                if (t.getBranch() == null || !filterBranch.equals(t.getBranch().getId())) {
                    continue;
                }
            }

            String pName = t.getPartnerName() != null && !t.getPartnerName().isBlank()
                    ? t.getPartnerName().trim() : "Partner";

            if (filterPartner != null && !pName.toLowerCase().contains(filterPartner)) {
                continue;
            }

            BigDecimal rev = t.getFinalPrice() != null ? t.getFinalPrice() : BigDecimal.ZERO;
            BigDecimal cost = t.getCostPrice() != null ? t.getCostPrice() : BigDecimal.ZERO;
            BigDecimal grossProfit = rev.subtract(cost);

            BigDecimal pShare = t.getPartnerShare() != null ? t.getPartnerShare() : BigDecimal.ZERO;
            BigDecimal cShare = t.getCpmShare() != null ? t.getCpmShare() : BigDecimal.ZERO;

            // If split wasn't populated on transaction, compute 50/50 fallback
            if (pShare.compareTo(BigDecimal.ZERO) == 0 && cShare.compareTo(BigDecimal.ZERO) == 0 && grossProfit.compareTo(BigDecimal.ZERO) > 0) {
                pShare = grossProfit.divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP);
                cShare = grossProfit.subtract(pShare);
            }

            String settlement = t.getPartnerSettlementStatus() != null ? t.getPartnerSettlementStatus() : "UNPAID";
            if ("PAID".equalsIgnoreCase(settlement)) {
                totalSettledPartnerShare = totalSettledPartnerShare.add(pShare);
            } else {
                totalUnsettledPartnerShare = totalUnsettledPartnerShare.add(pShare);
            }

            totalGrossRevenue = totalGrossRevenue.add(rev);
            totalCost = totalCost.add(cost);
            totalGrossProfit = totalGrossProfit.add(grossProfit);
            totalPartnerShare = totalPartnerShare.add(pShare);
            totalCpmShare = totalCpmShare.add(cShare);
            totalUnitsSold += 1;

            // Per partner breakdown
            Map<String, Object> pSummary = partnerBreakdown.computeIfAbsent(pName, k -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("partnerName", k);
                map.put("unitsSold", 0);
                map.put("grossRevenue", BigDecimal.ZERO);
                map.put("partnerShare", BigDecimal.ZERO);
                map.put("cpmShare", BigDecimal.ZERO);
                map.put("settledShare", BigDecimal.ZERO);
                map.put("unsettledShare", BigDecimal.ZERO);
                return map;
            });

            pSummary.put("unitsSold", (int) pSummary.get("unitsSold") + 1);
            pSummary.put("grossRevenue", ((BigDecimal) pSummary.get("grossRevenue")).add(rev));
            pSummary.put("partnerShare", ((BigDecimal) pSummary.get("partnerShare")).add(pShare));
            pSummary.put("cpmShare", ((BigDecimal) pSummary.get("cpmShare")).add(cShare));
            if ("PAID".equalsIgnoreCase(settlement)) {
                pSummary.put("settledShare", ((BigDecimal) pSummary.get("settledShare")).add(pShare));
            } else {
                pSummary.put("unsettledShare", ((BigDecimal) pSummary.get("unsettledShare")).add(pShare));
            }

            // Ledger entry
            ProductVariant pv = t.getVariant();
            Product prod = pv != null ? pv.getProduct() : null;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", t.getId());
            row.put("orderId", t.getTransactionId());
            row.put("partnerName", pName);
            row.put("productName", prod != null ? prod.getBrandName() + " " + prod.getModelName() : (pv != null ? pv.getSku() : "Partner Item"));
            row.put("sku", pv != null ? pv.getSku() : "");
            row.put("sellingPrice", rev);
            row.put("costPrice", cost);
            row.put("grossProfit", grossProfit);
            row.put("partnerShare", pShare);
            row.put("cpmShare", cShare);
            row.put("settlementStatus", settlement);
            // settledAt omitted
            row.put("transactionDate", t.getTransactionDate());
            row.put("branchName", t.getBranch() != null ? t.getBranch().getName() : "Central Master Admin");
            salesLedger.add(row);
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalGrossRevenue", totalGrossRevenue);
        summary.put("totalCost", totalCost);
        summary.put("totalGrossProfit", totalGrossProfit);
        summary.put("totalPartnerShare", totalPartnerShare);
        summary.put("totalCpmShare", totalCpmShare);
        summary.put("totalSettledPartnerShare", totalSettledPartnerShare);
        summary.put("totalUnsettledPartnerShare", totalUnsettledPartnerShare);
        summary.put("unitsSold", totalUnitsSold);

        return ResponseEntity.ok(Map.of(
                "summary", summary,
                "partnerBreakdown", new ArrayList<>(partnerBreakdown.values()),
                "salesLedger", salesLedger
        ));
    }

    @PostMapping("/settle/{transactionId}")
    @Transactional
    public ResponseEntity<?> toggleSettlement(
            @PathVariable Long transactionId,
            @RequestParam(defaultValue = "PAID") String status) {

        Transaction tx = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + transactionId));

        tx.setPartnerSettlementStatus(status.toUpperCase());
        if ("PAID".equalsIgnoreCase(status)) {
            // settledAt omitted
        } else {
            // settledAt omitted
        }
        transactionRepository.save(tx);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "transactionId", transactionId,
                "settlementStatus", tx.getPartnerSettlementStatus()
        ));
    }

    // =========================================================================
    // PARTNER INVENTORY & INTAKE
    // =========================================================================

    /**
     * GET /api/partner-products
     * Returns active partner inventory batches / products.
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
                    map.put("acquisitionPrice", b.getAcquisitionPrice() != null ? b.getAcquisitionPrice() : (v != null ? v.getAcquisitionPrice() : BigDecimal.ZERO));
                    map.put("recommendedSellingPrice", v != null && v.getRecommendedSellingPrice() != null ? v.getRecommendedSellingPrice() : (v != null ? v.getSellingPrice() : BigDecimal.ZERO));
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
     * Direct intake for partner items with custom Cost & Recommended Selling Price.
     */
    @PostMapping("/intake")
    @Transactional
    public ResponseEntity<?> intakePartnerStock(
            @RequestBody PartnerIntakeRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal UserPrincipal user) {

        String partnerName = (request.getPartnerName() != null && !request.getPartnerName().isBlank())
                ? request.getPartnerName().trim() : "Partner";
        BigDecimal splitPct = request.getPartnerSplitPct() != null
                ? request.getPartnerSplitPct() : new BigDecimal("50.00");

        // Ensure partner is in Partner table
        ensurePartnerExists(partnerName, splitPct);

        // Determine destination branch
        Long targetBranchId = request.getBranchId();
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            targetBranchId = user.getBranchId();
        }

        Branch branch = null;
        if (targetBranchId != null && targetBranchId > 0) {
            branch = branchRepository.findById(targetBranchId).orElse(null);
        }

        List<PartnerIntakeItem> items = request.getItems();
        if (items == null || items.isEmpty()) {
            if (request.getVariantId() != null && request.getQuantity() != null && request.getQuantity() > 0) {
                PartnerIntakeItem single = new PartnerIntakeItem();
                single.setVariantId(request.getVariantId());
                single.setQuantity(request.getQuantity());
                single.setAcquisitionPrice(request.getAcquisitionPrice());
                single.setRecommendedSellingPrice(request.getRecommendedSellingPrice());
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

            variant.setPartner(true);
            variant.setPartnerName(partnerName);
            variant.setPartnerSplitPct(splitPct);

            if (item.getAcquisitionPrice() != null) {
                variant.setAcquisitionPrice(item.getAcquisitionPrice());
            }
            if (item.getRecommendedSellingPrice() != null) {
                variant.setRecommendedSellingPrice(item.getRecommendedSellingPrice());
            }
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
     * Fast-create a new partner product & variant with different cost & recommended SRP.
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
                ? request.getPartnerName().trim() : "Partner";
        BigDecimal splitPct = request.getPartnerSplitPct() != null
                ? request.getPartnerSplitPct() : new BigDecimal("50.00");

        ensurePartnerExists(partnerName, splitPct);

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
        variant.setAcquisitionPrice(request.getAcquisitionPrice() != null ? request.getAcquisitionPrice() : BigDecimal.ZERO);
        variant.setRecommendedSellingPrice(request.getRecommendedSellingPrice() != null ? request.getRecommendedSellingPrice() : request.getSellingPrice());
        variant.setSellingPrice(request.getSellingPrice() != null ? request.getSellingPrice() : BigDecimal.ZERO);
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

    private void ensurePartnerExists(String partnerName, BigDecimal splitPct) {
        if (partnerName == null || partnerName.isBlank()) return;
        partnerRepository.findByNameIgnoreCase(partnerName.trim()).orElseGet(() -> {
            Partner p = new Partner();
            p.setName(partnerName.trim());
            p.setDefaultSplitPct(splitPct != null ? splitPct : new BigDecimal("50.00"));
            return partnerRepository.save(p);
        });
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
