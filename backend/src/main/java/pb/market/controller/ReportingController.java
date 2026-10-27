package pb.market.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import pb.market.dto.InventoryMovementDTO;

import pb.market.repository.StockBatchRepository;
import pb.market.repository.TransactionRepository;
import pb.market.repository.StockAdjustmentRepository;
import pb.market.repository.PaymentLogRepository;
import pb.market.repository.VariantRepository;
import pb.market.entity.ProductVariant;
import pb.market.dto.DailyInventoryDTO;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.LinkedHashMap;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/reporting")
@RequiredArgsConstructor
public class ReportingController {

    private final StockBatchRepository stockBatchRepository;
    private final TransactionRepository transactionRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final PaymentLogRepository paymentLogRepository;
    private final VariantRepository variantRepository;

    @Transactional(readOnly = true)
    @GetMapping("/inventory-ledger")
    public ResponseEntity<?> getInventoryLedger(@RequestParam(required = false) String date) {
        LocalDateTime start;
        LocalDateTime end;
        if (date != null && !date.isBlank()) {
            LocalDate d = LocalDate.parse(date);
            start = d.atStartOfDay();
            end = d.plusDays(1).atStartOfDay();
        } else {
            LocalDate today = LocalDate.now();
            start = today.atStartOfDay();
            end = today.plusDays(1).atStartOfDay();
        }

        List<ProductVariant> variants = variantRepository.findAllWithProduct();
        Map<Long, DailyInventoryDTO> map = new HashMap<>();
        for (ProductVariant v : variants) {
            String pName = "Unknown Product";
            String category = "Uncategorized";
            
            if (v.getProduct() != null) {
                category = v.getProduct().getCategory() != null ? v.getProduct().getCategory() : "Uncategorized";
                String baseName = v.getProduct().getBrandName() + " " + v.getProduct().getModelName();
                
                if ("Shoes".equalsIgnoreCase(category) && v.getShape() != null && !v.getShape().isBlank()) {
                    pName = baseName + " Size " + v.getShape();
                } else if ("Paddles".equalsIgnoreCase(category) && v.getThicknessMm() != null && v.getThicknessMm() > 0) {
                    pName = baseName + " " + v.getThicknessMm() + "mm";
                } else {
                    pName = baseName;
                }
            }
            
            DailyInventoryDTO dto = new DailyInventoryDTO(
                v.getId(), pName, category, v.getColor(), 0, 0, 0, 0, 0
            );
            map.put(v.getId(), dto);
        }

        // Get current stock mapping (same as Manage Inventory)
        List<Object[]> currentStockData = stockBatchRepository.sumRemainingQuantityByVariantId();
        Map<Long, Integer> stockMap = new HashMap<>();
        for (Object[] row : currentStockData) {
            Long vId = (Long) row[0];
            Long qtyLong = (Long) row[1];
            stockMap.put(vId, qtyLong.intValue());
        }

        // Initialize DTOs with Current Stock as the anchor
        for (DailyInventoryDTO dto : map.values()) {
            dto.setClosingStock(stockMap.getOrDefault(dto.getVariantId(), 0));
        }

        // We calculate movement ON the day, and reverse-calculate Closing Stock if 'end' is in the past.
        LocalDateTime now = LocalDateTime.now();

        // 1. Restocks
        List<Object[]> batches = stockBatchRepository.findAllVariantIdsQuantitiesAndDates();
        for (Object[] row : batches) {
            Long variantId = (Long) row[0];
            Integer quantity = (Integer) row[1];
            LocalDateTime restockedAt = (LocalDateTime) row[2];

            DailyInventoryDTO dto = map.get(variantId);
            if (dto == null) continue;

            if (restockedAt != null) {
                if (!restockedAt.isBefore(end)) {
                    // Restock happened AFTER the requested day. Reverse it to find the past stock.
                    dto.setClosingStock(dto.getClosingStock() - quantity);
                } else if (!restockedAt.isBefore(start) && restockedAt.isBefore(end)) {
                    // Restock happened ON the requested day.
                    dto.setRestocked(dto.getRestocked() + quantity);
                }
            }
        }

        // 2. Sales
        List<Object[]> transactions = transactionRepository.findAllVariantIdsAndDates();
        for (Object[] row : transactions) {
            Long variantId = (Long) row[0];
            LocalDateTime txDate = (LocalDateTime) row[1];

            DailyInventoryDTO dto = map.get(variantId);
            if (dto == null) continue;

            if (txDate != null) {
                if (!txDate.isBefore(end)) {
                    // Sale happened AFTER the requested day. Add it back to find the past stock.
                    dto.setClosingStock(dto.getClosingStock() + 1);
                } else if (!txDate.isBefore(start) && txDate.isBefore(end)) {
                    // Sale happened ON the requested day.
                    dto.setSold(dto.getSold() + 1);
                }
            }
        }

        // 3. Adjustments
        List<Object[]> adjustments = stockAdjustmentRepository.findAllVariantIdsQuantitiesAndDates();
        for (Object[] row : adjustments) {
            Long variantId = (Long) row[0];
            Integer quantity = (Integer) row[1];
            LocalDateTime adjustedAt = (LocalDateTime) row[2];

            DailyInventoryDTO dto = map.get(variantId);
            if (dto == null) continue;

            if (adjustedAt != null) {
                if (!adjustedAt.isBefore(end)) {
                    // Adjustment (deduction) happened AFTER the requested day. Add it back.
                    dto.setClosingStock(dto.getClosingStock() + Math.abs(quantity));
                } else if (!adjustedAt.isBefore(start) && adjustedAt.isBefore(end)) {
                    // Adjustment happened ON the requested day.
                    dto.setAdjusted(dto.getAdjusted() + Math.abs(quantity));
                }
            }
        }

        // Compute Starting Stock based on the properly anchored Closing Stock
        for (DailyInventoryDTO dto : map.values()) {
            if (dto.getClosingStock() < 0) {
                dto.setClosingStock(0);
            }
            int starting = dto.getClosingStock() - dto.getRestocked() + dto.getSold() + dto.getAdjusted();
            dto.setStartingStock(Math.max(starting, 0));
        }

        List<DailyInventoryDTO> result = new ArrayList<>(map.values());
        result.sort((d1, d2) -> {
            int cmp = d1.getProductName().compareToIgnoreCase(d2.getProductName());
            if (cmp != 0) return cmp;
            String c1 = d1.getColor() == null ? "" : d1.getColor();
            String c2 = d2.getColor() == null ? "" : d2.getColor();
            return c1.compareToIgnoreCase(c2);
        });

        return ResponseEntity.ok(result);
    }

    @Transactional(readOnly = true)
    @GetMapping("/financials")
    public ResponseEntity<?> getFinancialSummary(@RequestParam(required = false) String date) {
        LocalDateTime start = null;
        LocalDateTime end = null;
        if (date != null && !date.isBlank()) {
            LocalDate d = LocalDate.parse(date);
            start = d.atStartOfDay();
            end = d.plusDays(1).atStartOfDay();
        }

        // Use lightweight aggregate queries — one SQL call each, returns only numbers
        BigDecimal expectedRevenue;
        BigDecimal actualReceived;
        List<Object[]> methodRows;
        if (start != null) {
            expectedRevenue = transactionRepository.sumFinalPriceInRange(start, end);
            actualReceived  = paymentLogRepository.sumAmountInRange(start, end);
            methodRows      = paymentLogRepository.sumAmountByMethodInRange(start, end);
        } else {
            expectedRevenue = transactionRepository.sumFinalPriceAll();
            actualReceived  = paymentLogRepository.sumAmountAll();
            methodRows      = paymentLogRepository.sumAmountByMethodAll();
        }

        if (expectedRevenue == null) expectedRevenue = BigDecimal.ZERO;
        if (actualReceived  == null) actualReceived  = BigDecimal.ZERO;

        Map<String, BigDecimal> methodsBreakdown = new LinkedHashMap<>();
        for (Object[] row : methodRows) {
            String method = row[0] != null && !row[0].toString().isBlank() ? row[0].toString() : "Unknown";
            BigDecimal amount = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            methodsBreakdown.put(method, amount);
        }

        BigDecimal balanceDue = expectedRevenue.subtract(actualReceived);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("expectedRevenue", expectedRevenue);
        summary.put("actualReceived", actualReceived);
        summary.put("balanceDue", balanceDue);
        summary.put("methodsBreakdown", methodsBreakdown);

        return ResponseEntity.ok(summary);
    }

    /**
     * Lightweight income summary for Expenses &amp; Analytics pages.
     * Returns ONLY aggregate numbers — no entity loading, no JOIN FETCH.
     * Optional params: from/to (LocalDateTime ISO strings). If omitted, returns all-time totals.
     * Response: { totalIncome, paymentBreakdown: { method: amount } }
     */
    @Transactional(readOnly = true)
    @GetMapping("/income-summary")
    public ResponseEntity<?> getIncomeSummary(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) Long branchId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {

        if (user != null && "BRANCH".equals(user.getRole())) {
            branchId = user.getBranchId();
        }

        java.math.BigDecimal totalIncome;
        java.util.List<Object[]> methodRows;

        if (from != null && to != null) {
            LocalDateTime fromDt = LocalDateTime.parse(from);
            LocalDateTime toDt   = LocalDateTime.parse(to);
            if (branchId != null) {
                totalIncome = transactionRepository.sumFinalPriceInRangeAndBranch(fromDt, toDt, branchId);
                methodRows  = transactionRepository.sumFinalPriceByPaymentMethodInRangeAndBranch(fromDt, toDt, branchId);
            } else {
                totalIncome = transactionRepository.sumFinalPriceInRange(fromDt, toDt);
                methodRows  = transactionRepository.sumFinalPriceByPaymentMethodInRange(fromDt, toDt);
            }
        } else {
            if (branchId != null) {
                totalIncome = transactionRepository.sumFinalPriceAllByBranch(branchId);
                methodRows  = transactionRepository.sumFinalPriceByPaymentMethodAllByBranch(branchId);
            } else {
                totalIncome = transactionRepository.sumFinalPriceAll();
                methodRows  = transactionRepository.sumFinalPriceByPaymentMethodAll();
            }
        }

        if (totalIncome == null) totalIncome = java.math.BigDecimal.ZERO;

        Map<String, java.math.BigDecimal> paymentBreakdown = new LinkedHashMap<>();
        for (Object[] row : methodRows) {
            String method = row[0] != null && !row[0].toString().isBlank() ? row[0].toString() : "Unknown";
            java.math.BigDecimal amount = row[1] != null ? (java.math.BigDecimal) row[1] : java.math.BigDecimal.ZERO;
            paymentBreakdown.put(method, amount);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalIncome", totalIncome);
        result.put("paymentBreakdown", paymentBreakdown);
        return ResponseEntity.ok(result);
    }
}
