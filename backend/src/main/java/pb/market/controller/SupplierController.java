package pb.market.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pb.market.dto.SupplierConsignmentDTO;
import pb.market.dto.SupplierPurchaseDTO;
import pb.market.dto.SupplierStatsDTO;
import pb.market.dto.SupplierWithStatsDTO;
import pb.market.entity.StockBatch;
import pb.market.entity.Supplier;
import pb.market.repository.StockBatchRepository;
import pb.market.repository.SupplierRepository;
import pb.market.util.DateTimeUtil;
import pb.market.repository.TransactionRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/suppliers")
@RequiredArgsConstructor
public class SupplierController {

    private final SupplierRepository supplierRepository;
    private final TransactionRepository transactionRepository;
    private final StockBatchRepository stockBatchRepository;

    @GetMapping
    public List<Supplier> getAll() {
        return supplierRepository.findAll();
    }

    /** Suppliers list enriched with per-supplier purchase rollup + consigned-sold count over a date range. */
    @GetMapping("/with-stats")
    public List<SupplierWithStatsDTO> getAllWithStats(
            @RequestParam("start") String startStr,
            @RequestParam("end") String endStr) {
        LocalDateTime start = DateTimeUtil.parseStart(startStr);
        LocalDateTime end = DateTimeUtil.parseEnd(endStr);
        if (start == null) start = LocalDateTime.of(2020, 1, 1, 0, 0);
        if (end == null) end = LocalDateTime.now();

        List<Supplier> suppliers = supplierRepository.findAll();

        // Per-supplier rollups, keyed by supplier id
        Map<Long, long[]> batchCounts = new HashMap<>();      // [batches, units]
        Map<Long, BigDecimal[]> spend = new HashMap<>();      // [ownedSpend, consignedOwed]
        Map<Long, LocalDateTime> lastPurchase = new HashMap<>();

        for (Object[] row : stockBatchRepository.sumPurchasesBySupplierInRange(start, end)) {
            Long sid = ((Number) row[0]).longValue();
            boolean consigned = Boolean.TRUE.equals(row[1]);
            long count = ((Number) row[2]).longValue();
            long units = row[3] != null ? ((Number) row[3]).longValue() : 0L;
            BigDecimal cost = row[4] != null ? (BigDecimal) row[4] : BigDecimal.ZERO;
            LocalDateTime last = (LocalDateTime) row[5];

            long[] c = batchCounts.computeIfAbsent(sid, k -> new long[]{0L, 0L});
            c[0] += count;
            c[1] += units;

            BigDecimal[] s = spend.computeIfAbsent(sid, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            if (consigned) s[1] = s[1].add(cost);
            else           s[0] = s[0].add(cost);

            lastPurchase.merge(sid, last, (a, b) -> a.isAfter(b) ? a : b);
        }

        Map<Long, Long> consignedSold = transactionRepository.countSoldConsignedBySupplierInRange(start, end).stream()
                .collect(Collectors.toMap(
                        row -> ((Number) row[0]).longValue(),
                        row -> row[1] != null ? ((Number) row[1]).longValue() : 0L
                ));

        return suppliers.stream().map(s -> {
            long[] c = batchCounts.getOrDefault(s.getId(), new long[]{0L, 0L});
            BigDecimal[] sp = spend.getOrDefault(s.getId(), new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            return new SupplierWithStatsDTO(
                    s.getId(), s.getName(), s.getContactInfo(),
                    s.getPhone(), s.getEmail(), s.getAddress(), s.getNotes(),
                    c[0], c[1], sp[0], sp[1],
                    lastPurchase.get(s.getId()),
                    consignedSold.getOrDefault(s.getId(), 0L)
            );
        }).collect(Collectors.toList());
    }

    /** Page-level stat cards: counts + spend + top supplier in the active date range. */
    @GetMapping("/stats")
    public SupplierStatsDTO getStats(
            @RequestParam("start") String startStr,
            @RequestParam("end") String endStr) {
        LocalDateTime start = DateTimeUtil.parseStart(startStr);
        LocalDateTime end = DateTimeUtil.parseEnd(endStr);
        if (start == null) start = LocalDateTime.of(2020, 1, 1, 0, 0);
        if (end == null) end = LocalDateTime.now();

        long totalSuppliers = supplierRepository.count();

        BigDecimal ownedSpend = BigDecimal.ZERO;
        BigDecimal consignedOwed = BigDecimal.ZERO;
        Map<Long, BigDecimal> spendBySupplier = new HashMap<>();

        for (Object[] row : stockBatchRepository.sumPurchasesBySupplierInRange(start, end)) {
            Long sid = ((Number) row[0]).longValue();
            boolean consigned = Boolean.TRUE.equals(row[1]);
            BigDecimal cost = row[4] != null ? (BigDecimal) row[4] : BigDecimal.ZERO;
            if (consigned) consignedOwed = consignedOwed.add(cost);
            else           ownedSpend    = ownedSpend.add(cost);
            spendBySupplier.merge(sid, cost, BigDecimal::add);
        }

        long activeSuppliers = spendBySupplier.size();

        String topName = null;
        BigDecimal topTotal = BigDecimal.ZERO;
        if (!spendBySupplier.isEmpty()) {
            Map.Entry<Long, BigDecimal> top = spendBySupplier.entrySet().stream()
                    .max(Comparator.comparing(Map.Entry::getValue))
                    .orElse(null);
            if (top != null) {
                topTotal = top.getValue();
                topName = supplierRepository.findById(top.getKey()).map(Supplier::getName).orElse(null);
            }
        }

        return new SupplierStatsDTO(totalSuppliers, activeSuppliers, ownedSpend, consignedOwed, topName, topTotal);
    }

    /** Purchase history for one supplier within a date range. */
    @GetMapping("/{id}/purchases")
    public ResponseEntity<?> getPurchases(
            @PathVariable("id") Long id,
            @RequestParam("start") String startStr,
            @RequestParam("end") String endStr) {
        if (!supplierRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        LocalDateTime start = DateTimeUtil.parseStart(startStr);
        LocalDateTime end = DateTimeUtil.parseEnd(endStr);
        if (start == null) start = LocalDateTime.of(2020, 1, 1, 0, 0);
        if (end == null) end = LocalDateTime.now();

        List<SupplierPurchaseDTO> result = new ArrayList<>();
        for (StockBatch b : stockBatchRepository.findPurchasesBySupplierInRange(id, start, end)) {
            BigDecimal qty = b.getQuantity() == null ? BigDecimal.ZERO : BigDecimal.valueOf(b.getQuantity());
            BigDecimal price = b.getAcquisitionPrice() == null ? BigDecimal.ZERO : b.getAcquisitionPrice();
            result.add(new SupplierPurchaseDTO(
                    b.getId(),
                    b.getBatchId(),
                    b.getRestockedAt(),
                    b.getEta(),
                    b.getStatus(),
                    b.isConsigned(),
                    b.getVariant() != null ? b.getVariant().getId() : null,
                    b.getVariant() != null ? b.getVariant().getSku() : null,
                    b.getVariant() != null ? b.getVariant().getColor() : null,
                    b.getVariant() != null && b.getVariant().getProduct() != null ? b.getVariant().getProduct().getBrandName() : null,
                    b.getVariant() != null && b.getVariant().getProduct() != null ? b.getVariant().getProduct().getModelName() : null,
                    b.getVariant() != null && b.getVariant().getProduct() != null ? b.getVariant().getProduct().getCategory() : null,
                    b.getQuantity(),
                    b.getRemainingQuantity(),
                    b.getAcquisitionPrice(),
                    qty.multiply(price)
            ));
        }
        return ResponseEntity.ok(result);
    }

    /** Legacy endpoint kept for any external callers. */
    @GetMapping("/reports/consignment")
    public List<SupplierConsignmentDTO> getConsignmentReport(
            @RequestParam("start") String startStr,
            @RequestParam("end") String endStr) {

        LocalDateTime start = DateTimeUtil.parseStart(startStr);
        LocalDateTime end = DateTimeUtil.parseEnd(endStr);
        if (start == null) start = LocalDateTime.of(2020, 1, 1, 0, 0);
        if (end == null) end = LocalDateTime.now();

        List<Supplier> suppliers = supplierRepository.findAll();
        Map<Long, Long> counts = transactionRepository.countSoldConsignedBySupplierInRange(start, end).stream()
                .collect(Collectors.toMap(
                        row -> ((Number) row[0]).longValue(),
                        row -> row[1] != null ? ((Number) row[1]).longValue() : 0L
                ));

        return suppliers.stream().map(s -> new SupplierConsignmentDTO(
                s.getId(),
                s.getName(),
                counts.getOrDefault(s.getId(), 0L)
        )).collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Supplier supplier) {
        if (supplier.getName() == null || supplier.getName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Supplier name is required."));
        }
        return ResponseEntity.ok(supplierRepository.save(supplier));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable("id") Long id, @RequestBody Supplier update) {
        return supplierRepository.findById(id).map(existing -> {
            existing.setName(update.getName());
            existing.setContactInfo(update.getContactInfo());
            existing.setPhone(update.getPhone());
            existing.setEmail(update.getEmail());
            existing.setAddress(update.getAddress());
            existing.setNotes(update.getNotes());
            return ResponseEntity.ok(supplierRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") Long id) {
        if (!supplierRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        boolean hasStockBatches = !stockBatchRepository.findBySupplierId(id).isEmpty();
        boolean hasTransactions = !transactionRepository.findBySupplierId(id).isEmpty();
        if (hasStockBatches || hasTransactions) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Cannot delete supplier: it is referenced by existing stock batches or transactions. Remove those references first."
            ));
        }
        supplierRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Supplier deleted"));
    }
}
