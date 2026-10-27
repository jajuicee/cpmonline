package pb.market.controller;

import jakarta.persistence.EntityManager;
import pb.market.config.StockWebSocketHandler;
import pb.market.entity.ProductVariant;
import pb.market.entity.StockBatch;
import pb.market.entity.Transaction;
import pb.market.entity.PaymentLog;
import pb.market.repository.StockBatchRepository;
import pb.market.repository.TransactionRepository;
import pb.market.repository.VariantRepository;
import pb.market.repository.ConsigneeRepository;
import pb.market.repository.PaymentLogRepository;
import pb.market.entity.Consignee;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import pb.market.dto.CategorySalesDTO;
import pb.market.dto.CategorySalesSummaryDTO;
import pb.market.dto.ProductRankingDTO;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {
    private final TransactionRepository transactionRepository;
    private final VariantRepository variantRepository;
    private final StockBatchRepository stockBatchRepository;
    private final EntityManager entityManager;
    private final StockWebSocketHandler stockWebSocketHandler;
    private final ConsigneeRepository consigneeRepository;
    private final PaymentLogRepository paymentLogRepository;
    private final pb.market.repository.BranchRepository branchRepository;

    // ── Create a new transaction + deduct 1 from stock ───────────────────────
    @Transactional
    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody Transaction transaction,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (transaction.getVariant() == null || transaction.getVariant().getId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Variant ID is required."));
        }
        Long variantId = transaction.getVariant().getId();
        var variantOpt = variantRepository.findById(variantId);
        if (variantOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Variant not found with id: " + variantId));
        }
        ProductVariant variant = variantOpt.get();

        Long branchId = null;
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            branchId = user.getBranchId();
        } else if (transaction.getBranch() != null && transaction.getBranch().getId() != null) {
            branchId = transaction.getBranch().getId();
        }

        List<StockBatch> batches;
        if (branchId != null) {
            branchRepository.findById(branchId).ifPresent(transaction::setBranch);
            // Find oldest stock batch for FIFO in this branch using a PESSIMISTIC WRITE lock.
            batches = stockBatchRepository.findReceivableByVariantIdAndBranchIdForUpdate(variantId, branchId);
            if (batches.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "This item is out of stock in this branch."));
            }
        } else {
            // HQ Direct Sale: deduct strictly from Central HQ Master Inventory (Holding Pool: branch IS NULL)
            transaction.setBranch(null);
            batches = stockBatchRepository.findReceivableForHoldingForUpdate(variantId);
            if (batches.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "This item is out of stock in Central Master Inventory."));
            }
        }

        // Deduct 1 from the oldest batch (FIFO)
        StockBatch oldestBatch = batches.get(0);
        oldestBatch.setRemainingQuantity(oldestBatch.getRemainingQuantity() - 1);
        stockBatchRepository.save(oldestBatch);
        
        transaction.setCostPrice(oldestBatch.getAcquisitionPrice());
        transaction.setSupplier(oldestBatch.getSupplier());
        transaction.setConsigned(oldestBatch.isConsigned());
        transaction.setStockBatch(oldestBatch);

        if ("CONSIGNMENT".equals(transaction.getTransactionType()) && transaction.getConsignee() != null && transaction.getConsignee().getId() != null) {
            Consignee consignee = consigneeRepository.findById(transaction.getConsignee().getId()).orElse(null);
            transaction.setConsignee(consignee);
        }

        // Two-way synchronization between notes and paymentDetails
        if (transaction.getNotes() == null && transaction.getPaymentDetails() != null) {
            transaction.setNotes(transaction.getPaymentDetails());
        } else if (transaction.getPaymentDetails() == null && transaction.getNotes() != null) {
            transaction.setPaymentDetails(transaction.getNotes());
        }

        // Save the transaction
        Transaction saved = transactionRepository.save(transaction);

        // If paid at checkout, create a payment log immediately
        if (transaction.getSplits() != null && !transaction.getSplits().isEmpty()) {
            for (java.util.Map<String, Object> split : transaction.getSplits()) {
                BigDecimal amt = new BigDecimal(split.get("amount").toString());
                String method = String.valueOf(split.get("method"));
                BigDecimal finalPrice = saved.getFinalPrice() != null && saved.getFinalPrice().compareTo(BigDecimal.ZERO) > 0 ? saved.getFinalPrice() : BigDecimal.ONE;
                BigDecimal cost = saved.getCostPrice() != null ? saved.getCostPrice() : BigDecimal.ZERO;
                BigDecimal costPortion = cost.multiply(amt).divide(finalPrice, 2, java.math.RoundingMode.HALF_UP);
                createPaymentLog(saved, amt, costPortion, method);
            }
        } else if ("FULL".equalsIgnoreCase(saved.getStatus())) {
            BigDecimal finalPrice = saved.getFinalPrice() != null ? saved.getFinalPrice() : BigDecimal.ZERO;
            BigDecimal cost = saved.getCostPrice() != null ? saved.getCostPrice() : BigDecimal.ZERO;
            createPaymentLog(saved, finalPrice, cost, saved.getPaymentMethod());
        } else if ("PARTIAL".equalsIgnoreCase(saved.getStatus())) {
            BigDecimal downpayment = saved.getDownpayment() != null ? saved.getDownpayment() : BigDecimal.ZERO;
            if (downpayment.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal finalPrice = saved.getFinalPrice() != null && saved.getFinalPrice().compareTo(BigDecimal.ZERO) > 0 ? saved.getFinalPrice() : BigDecimal.ONE;
                BigDecimal cost = saved.getCostPrice() != null ? saved.getCostPrice() : BigDecimal.ZERO;
                BigDecimal costPortion = cost.multiply(downpayment).divide(finalPrice, 2, java.math.RoundingMode.HALF_UP);
                createPaymentLog(saved, downpayment, costPortion, saved.getPaymentMethod());
            }
        }
        
        // Reload with JOIN FETCH so lazy relations are initialized before JSON serialization
        ResponseEntity<?> response = ResponseEntity.ok(transactionRepository.findByIdWithDetails(saved.getId()).orElse(saved));
        // Notify all connected clients that stock has changed
        stockWebSocketHandler.broadcastStockUpdate();
        return response;
    }


    // ── Get transactions with optional date-range filter ─────────────────────
    @GetMapping
    public List<Transaction> getAll(
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to",   required = false) String toStr,
            @RequestParam(value = "limit", required = false, defaultValue = "100000") int limit,
            @RequestParam(value = "branchId", required = false) Long branchId,
            @RequestParam(value = "onlyHq", required = false, defaultValue = "false") boolean onlyHq,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            branchId = user.getBranchId();
            onlyHq = false;
        }
        org.springframework.data.domain.Pageable page = org.springframework.data.domain.PageRequest.of(0, limit);
        if (onlyHq) {
            if (fromStr != null && toStr != null) {
                java.time.LocalDateTime from = java.time.LocalDateTime.parse(fromStr);
                java.time.LocalDateTime to   = java.time.LocalDateTime.parse(toStr);
                return transactionRepository.findAllWithDetailsByActivityDateHq(from, to, page);
            }
            return transactionRepository.findAllWithDetailsHq(page);
        }
        if (fromStr != null && toStr != null) {
            java.time.LocalDateTime from = java.time.LocalDateTime.parse(fromStr);
            java.time.LocalDateTime to   = java.time.LocalDateTime.parse(toStr);
            return transactionRepository.findAllWithDetailsByActivityDateAndBranch(from, to, branchId, page);
        }
        return transactionRepository.findAllWithDetailsByBranch(branchId, page);
    }

    // ── Get only HQ Direct transactions (Admin retail sales from Master Holding Pool) ──
    @GetMapping("/hq")
    public List<Transaction> getHqDirectTransactions(
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to",   required = false) String toStr,
            @RequestParam(value = "limit", required = false, defaultValue = "100000") int limit) {
        org.springframework.data.domain.Pageable page = org.springframework.data.domain.PageRequest.of(0, limit);
        if (fromStr != null && toStr != null) {
            java.time.LocalDateTime from = java.time.LocalDateTime.parse(fromStr);
            java.time.LocalDateTime to   = java.time.LocalDateTime.parse(toStr);
            return transactionRepository.findAllWithDetailsByActivityDateHq(from, to, page);
        }
        return transactionRepository.findAllWithDetailsHq(page);
    }


    // ── Get only CONSIGNMENT transactions (for ConsigneesPage) ───────────────
    @GetMapping("/consignment")
    public List<Transaction> getConsignmentAll(
            @RequestParam(value = "branchId", required = false) Long branchId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            branchId = user.getBranchId();
        }
        return transactionRepository.findAllConsignmentWithDetailsByBranch(
                branchId, org.springframework.data.domain.PageRequest.of(0, 100000));
    }

    // ── Category Sales breakdown & percentages ──────────────────────────────
    @GetMapping("/category-sales")
    public ResponseEntity<pb.market.dto.CategorySalesSummaryDTO> getCategorySales(
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to",   required = false) String toStr,
            @RequestParam(value = "branchId", required = false) Long branchId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            branchId = user.getBranchId();
        }

        List<Object[]> rows;
        if (fromStr != null && !fromStr.isBlank() && toStr != null && !toStr.isBlank()) {
            java.time.LocalDateTime from = java.time.LocalDateTime.parse(fromStr);
            java.time.LocalDateTime to   = java.time.LocalDateTime.parse(toStr);
            rows = transactionRepository.findCategorySalesInRange(from, to, branchId);
        } else {
            rows = transactionRepository.findCategorySalesAllTime(branchId);
        }

        BigDecimal totalRevenue = BigDecimal.ZERO;
        long totalUnits = 0;
        BigDecimal totalCost = BigDecimal.ZERO;

        for (Object[] r : rows) {
            long units = ((Number) r[1]).longValue();
            BigDecimal rev = (BigDecimal) r[2];
            BigDecimal cost = (BigDecimal) r[3];
            totalUnits += units;
            totalRevenue = totalRevenue.add(rev != null ? rev : BigDecimal.ZERO);
            totalCost = totalCost.add(cost != null ? cost : BigDecimal.ZERO);
        }

        BigDecimal totalProfit = totalRevenue.subtract(totalCost);
        double overallMargin = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                ? totalProfit.multiply(BigDecimal.valueOf(100)).divide(totalRevenue, 2, java.math.RoundingMode.HALF_UP).doubleValue()
                : 0.0;

        List<pb.market.dto.CategorySalesDTO> categories = new java.util.ArrayList<>();
        for (Object[] r : rows) {
            String cat = r[0] != null ? (String) r[0] : "Uncategorized";
            long units = ((Number) r[1]).longValue();
            BigDecimal rev = r[2] != null ? (BigDecimal) r[2] : BigDecimal.ZERO;
            BigDecimal cost = r[3] != null ? (BigDecimal) r[3] : BigDecimal.ZERO;
            BigDecimal profit = rev.subtract(cost);

            double revPct = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                    ? rev.multiply(BigDecimal.valueOf(100)).divide(totalRevenue, 2, java.math.RoundingMode.HALF_UP).doubleValue()
                    : 0.0;
            double unitPct = totalUnits > 0
                    ? (double) Math.round(((double) units / totalUnits * 100.0) * 100.0) / 100.0
                    : 0.0;
            BigDecimal avgPrice = units > 0
                    ? rev.divide(BigDecimal.valueOf(units), 2, java.math.RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            double margin = rev.compareTo(BigDecimal.ZERO) > 0
                    ? profit.multiply(BigDecimal.valueOf(100)).divide(rev, 2, java.math.RoundingMode.HALF_UP).doubleValue()
                    : 0.0;

            categories.add(pb.market.dto.CategorySalesDTO.builder()
                    .category(cat)
                    .unitsSold(units)
                    .revenue(rev)
                    .cost(cost)
                    .profit(profit)
                    .revenuePercentage(revPct)
                    .unitsPercentage(unitPct)
                    .avgSellingPrice(avgPrice)
                    .profitMargin(margin)
                    .build());
        }

        pb.market.dto.CategorySalesSummaryDTO summary = pb.market.dto.CategorySalesSummaryDTO.builder()
                .totalRevenue(totalRevenue)
                .totalUnitsSold(totalUnits)
                .totalCost(totalCost)
                .totalProfit(totalProfit)
                .overallProfitMargin(overallMargin)
                .categories(categories)
                .build();

        return ResponseEntity.ok(summary);
    }

    // ── Variant Sales breakdown (for ultra-fast Product Sales page) ───────────
    @GetMapping("/variant-sales")
    public ResponseEntity<?> getVariantSales(
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to",   required = false) String toStr,
            @RequestParam(value = "branchId", required = false) Long branchId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            branchId = user.getBranchId();
        }

        List<Object[]> rows;
        if (fromStr != null && !fromStr.isBlank() && toStr != null && !toStr.isBlank()) {
            java.time.LocalDateTime from = java.time.LocalDateTime.parse(fromStr);
            java.time.LocalDateTime to   = java.time.LocalDateTime.parse(toStr);
            rows = transactionRepository.findVariantSalesInRange(from, to, branchId);
        } else {
            rows = transactionRepository.findVariantSalesAllTime(branchId);
        }

        Map<Long, Map<String, Object>> map = new HashMap<>();
        for (Object[] r : rows) {
            if (r[0] != null) {
                Long vId = ((Number) r[0]).longValue();
                long units = ((Number) r[1]).longValue();
                BigDecimal rev = r[2] != null ? (BigDecimal) r[2] : BigDecimal.ZERO;
                map.put(vId, Map.of("unitsSold", units, "revenue", rev));
            }
        }
        return ResponseEntity.ok(map);
    }

    // ── Top Ranking Units (for Branch Sales and leaderboard) ─────────────────
    @GetMapping("/ranking")
    public ResponseEntity<List<pb.market.dto.ProductRankingDTO>> getTopRankingUnits(
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to",   required = false) String toStr,
            @RequestParam(value = "branchId", required = false) Long branchId,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "limit", required = false, defaultValue = "50") int limit,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            branchId = user.getBranchId();
        }

        org.springframework.data.domain.Pageable page = org.springframework.data.domain.PageRequest.of(0, limit);
        List<Object[]> rows;
        if (fromStr != null && !fromStr.isBlank() && toStr != null && !toStr.isBlank()) {
            java.time.LocalDateTime from = java.time.LocalDateTime.parse(fromStr);
            java.time.LocalDateTime to   = java.time.LocalDateTime.parse(toStr);
            rows = transactionRepository.findTopRankingUnitsInRange(from, to, branchId, page);
        } else {
            rows = transactionRepository.findTopRankingUnitsAllTime(branchId, page);
        }

        List<pb.market.dto.ProductRankingDTO> ranking = new java.util.ArrayList<>();
        int rank = 1;
        for (Object[] r : rows) {
            Long vId = ((Number) r[0]).longValue();
            String brand = r[1] != null ? (String) r[1] : "";
            String model = r[2] != null ? (String) r[2] : "";
            String color = r[3] != null ? (String) r[3] : "";
            String shape = r[4] != null ? (String) r[4] : "";
            Integer thick = r[5] != null ? ((Number) r[5]).intValue() : null;
            String sku = r[6] != null ? (String) r[6] : "";
            String cat = r[7] != null ? (String) r[7] : "Uncategorized";
            long units = ((Number) r[8]).longValue();
            BigDecimal rev = r[9] != null ? (BigDecimal) r[9] : BigDecimal.ZERO;

            if (category != null && !category.isBlank() && !"All".equalsIgnoreCase(category)) {
                if (!cat.equalsIgnoreCase(category)) continue;
            }

            StringBuilder nameBuilder = new StringBuilder(brand).append(" ").append(model);
            if (color != null && !color.isBlank() && !"N/A".equalsIgnoreCase(color)) {
                nameBuilder.append(" (").append(color).append(")");
            }
            if (thick != null && thick > 0) {
                nameBuilder.append(" ").append(thick).append("mm");
            }
            if (shape != null && !shape.isBlank() && !"N/A".equalsIgnoreCase(shape)) {
                nameBuilder.append(" Size ").append(shape);
            }

            ranking.add(pb.market.dto.ProductRankingDTO.builder()
                    .rank(rank++)
                    .variantId(vId)
                    .productName(nameBuilder.toString().trim())
                    .brandName(brand)
                    .modelName(model)
                    .color(color)
                    .shape(shape)
                    .thicknessMm(thick)
                    .sku(sku)
                    .category(cat)
                    .unitsSold(units)
                    .revenue(rev)
                    .build());
        }

        return ResponseEntity.ok(ranking);
    }

    // ── Mark a PARTIAL transaction as FULL once remaining balance is paid ─────


    @Transactional
    @PatchMapping("/{id}/complete")
    public ResponseEntity<?> complete(@PathVariable("id") Long id, @RequestBody(required = false) Map<String, String> body) {
        Transaction t = transactionRepository.findById(id).orElse(null);
        if (t == null) {
            return ResponseEntity.notFound().build();
        }
        if ("FULL".equalsIgnoreCase(t.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Transaction is already completed."));
        }
        
        String reqMethod = (body != null && body.containsKey("paymentMethod")) ? body.get("paymentMethod") : null;
        if (reqMethod != null && !reqMethod.isBlank()) {
            t.setPaymentMethod(reqMethod);
        }

        BigDecimal finalPrice = t.getFinalPrice() != null ? t.getFinalPrice() : BigDecimal.ZERO;
        BigDecimal downpayment = t.getDownpayment() != null ? t.getDownpayment() : BigDecimal.ZERO;
        BigDecimal remainingBalance = finalPrice.subtract(downpayment);
        BigDecimal cost = t.getCostPrice() != null ? t.getCostPrice() : BigDecimal.ZERO;
        // Cost portion for remaining balance
        BigDecimal costPortion = finalPrice.compareTo(BigDecimal.ZERO) > 0
                ? cost.multiply(remainingBalance).divide(finalPrice, 2, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        t.setStatus("FULL");
        transactionRepository.save(t);

        createPaymentLog(t, remainingBalance, costPortion, t.getPaymentMethod());

        return ResponseEntity.ok(Map.of("message", "Transaction marked as completed.", "transactionId", id));
    }

    // ── Update payment method for an entire order group ───────────────────────
    @Transactional
    @PatchMapping("/group/{transactionId}/payment")
    public ResponseEntity<?> updatePaymentMethod(
            @PathVariable("transactionId") String transactionId,
            @RequestBody Map<String, Object> body) {

        String newMethod = body.containsKey("paymentMethod") ? String.valueOf(body.get("paymentMethod")) : null;
        if (newMethod == null || newMethod.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "paymentMethod is required."));
        }
        
        boolean updateLogs = false;
        if (body.containsKey("updateLogs")) {
            updateLogs = Boolean.parseBoolean(String.valueOf(body.get("updateLogs")));
        }

        List<Transaction> group;
        if (transactionId.startsWith("LEGACY-")) {
            try {
                Long id = Long.parseLong(transactionId.replace("LEGACY-", ""));
                group = transactionRepository.findById(id).map(List::of).orElse(Collections.emptyList());
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid transaction ID format: " + transactionId));
            }
        } else {
            group = transactionRepository.findByTransactionId(transactionId);
        }

        if (group.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        for (Transaction tx : group) {
            tx.setPaymentMethod(newMethod);
            transactionRepository.save(tx);
        }

        if (updateLogs) {
            List<pb.market.entity.PaymentLog> logs = paymentLogRepository.findByOrderId(transactionId);
            for (pb.market.entity.PaymentLog log : logs) {
                log.setPaymentMethod(newMethod);
                paymentLogRepository.save(log);
            }
        }

        return ResponseEntity.ok(Map.of("message", "Payment method updated.", "transactionId", transactionId));
    }

    // ── Mark all PARTIAL/UNPAID items in a group as FULL ──────────────────────
    @Transactional
    @PatchMapping("/group/{transactionId}/complete")
    public ResponseEntity<?> completeGroup(
            @PathVariable("transactionId") String transactionId,
            @RequestBody(required = false) Map<String, String> body) {
        
        String reqMethod = (body != null && body.containsKey("paymentMethod")) ? body.get("paymentMethod") : null;
        
        List<Transaction> group;
        if (transactionId.startsWith("LEGACY-")) {
            try {
                Long id = Long.parseLong(transactionId.replace("LEGACY-", ""));
                group = transactionRepository.findById(id).map(List::of).orElse(Collections.emptyList());
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid transaction ID format: " + transactionId));
            }
        } else {
            group = transactionRepository.findByTransactionId(transactionId);
        }

        if (group.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        boolean updated = false;
        for (Transaction tx : group) {
            if (!"FULL".equalsIgnoreCase(tx.getStatus())) {
                if (reqMethod != null && !reqMethod.isBlank()) {
                    tx.setPaymentMethod(reqMethod);
                }
                
                BigDecimal finalPrice = tx.getFinalPrice() != null ? tx.getFinalPrice() : BigDecimal.ZERO;
                BigDecimal downpayment = tx.getDownpayment() != null ? tx.getDownpayment() : BigDecimal.ZERO;
                BigDecimal remainingBalance = finalPrice.subtract(downpayment);
                BigDecimal cost = tx.getCostPrice() != null ? tx.getCostPrice() : BigDecimal.ZERO;
                BigDecimal costPortion = finalPrice.compareTo(BigDecimal.ZERO) > 0
                        ? cost.multiply(remainingBalance).divide(finalPrice, 2, java.math.RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;

                tx.setStatus("FULL");
                transactionRepository.save(tx);

                createPaymentLog(tx, remainingBalance, costPortion, tx.getPaymentMethod());
                updated = true;
            }
        }

        if (!updated) {
            return ResponseEntity.badRequest().body(Map.of("error", "All items are already fully paid."));
        }

        return ResponseEntity.ok(Map.of("message", "All items in the order marked as paid.", "transactionId", transactionId));
    }

    // ── Apply a lump sum partial payment across an order group ────────────────────
    @Transactional
    @PatchMapping("/group/{transactionId}/pay-partial")
    public ResponseEntity<?> payPartialGroup(
            @PathVariable("transactionId") String transactionId,
            @RequestBody Map<String, Object> body) {
        
        if (!body.containsKey("amount")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Amount is required."));
        }
        
        java.math.BigDecimal amount;
        try {
            amount = new java.math.BigDecimal(body.get("amount").toString());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid amount format."));
        }

        if (amount.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Amount must be greater than zero."));
        }

        List<Transaction> group;
        if (transactionId.startsWith("LEGACY-")) {
            try {
                Long id = Long.parseLong(transactionId.replace("LEGACY-", ""));
                group = transactionRepository.findById(id).map(List::of).orElse(Collections.emptyList());
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid transaction ID format."));
            }
        } else {
            group = transactionRepository.findByTransactionId(transactionId);
        }

        if (group.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        java.math.BigDecimal remainingPayment = amount;
        String reqMethod = body.containsKey("paymentMethod") ? body.get("paymentMethod").toString() : null;

        boolean updated = false;

        for (Transaction tx : group) {
            if ("FULL".equalsIgnoreCase(tx.getStatus())) {
                continue;
            }

            if (reqMethod != null && !reqMethod.isBlank()) {
                tx.setPaymentMethod(reqMethod);
            }

            java.math.BigDecimal finalPrice = tx.getFinalPrice() != null ? tx.getFinalPrice() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal downpayment = tx.getDownpayment() != null ? tx.getDownpayment() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal balance = finalPrice.subtract(downpayment);

            if (balance.compareTo(java.math.BigDecimal.ZERO) <= 0) {
                tx.setStatus("FULL");
                transactionRepository.save(tx);
                continue;
            }

            if (remainingPayment.compareTo(java.math.BigDecimal.ZERO) <= 0) {
                break; // Payment amount exhausted
            }

            if (remainingPayment.compareTo(balance) >= 0) {
                // Fully pay this item
                BigDecimal paidAmount = balance;
                tx.setDownpayment(finalPrice);
                tx.setStatus("FULL");
                remainingPayment = remainingPayment.subtract(balance);
                updated = true;

                BigDecimal cost = tx.getCostPrice() != null ? tx.getCostPrice() : BigDecimal.ZERO;
                BigDecimal costPortion = finalPrice.compareTo(BigDecimal.ZERO) > 0
                        ? cost.multiply(paidAmount).divide(finalPrice, 2, java.math.RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;
                createPaymentLog(tx, paidAmount, costPortion, tx.getPaymentMethod());
            } else {
                // Partially pay this item
                BigDecimal paidAmount = remainingPayment;
                tx.setDownpayment(downpayment.add(remainingPayment));
                tx.setStatus("PARTIAL");
                remainingPayment = java.math.BigDecimal.ZERO;
                updated = true;

                BigDecimal cost = tx.getCostPrice() != null ? tx.getCostPrice() : BigDecimal.ZERO;
                BigDecimal costPortion = finalPrice.compareTo(BigDecimal.ZERO) > 0
                        ? cost.multiply(paidAmount).divide(finalPrice, 2, java.math.RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;
                createPaymentLog(tx, paidAmount, costPortion, tx.getPaymentMethod());
            }
            transactionRepository.save(tx);
        }

        if (!updated) {
            return ResponseEntity.badRequest().body(Map.of("error", "Order is already fully paid or no balance to pay."));
        }

        return ResponseEntity.ok(Map.of("message", "Payment applied successfully.", "transactionId", transactionId));
    }

    // ── Apply a partial payment to a specific list of selected items ────────────
    @Transactional
    @PatchMapping("/pay-selected")
    public ResponseEntity<?> paySelectedItems(@RequestBody Map<String, Object> body) {
        if (!body.containsKey("amount") || !body.containsKey("itemIds")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Amount and itemIds are required."));
        }
        
        java.math.BigDecimal amount;
        try {
            amount = new java.math.BigDecimal(body.get("amount").toString());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid amount format."));
        }

        @SuppressWarnings("unchecked")
        List<Number> itemIds = (List<Number>) body.get("itemIds");
        if (itemIds == null || itemIds.isEmpty() || amount.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid input."));
        }

        List<Transaction> itemsToPay = transactionRepository.findAllById(
            itemIds.stream().map(Number::longValue).collect(java.util.stream.Collectors.toList())
        );

        // Sort by remaining balance ascending to ensure the paddles closest to being fully paid or cheapest are settled first
        itemsToPay.sort(java.util.Comparator.comparing(t -> {
            java.math.BigDecimal fp = t.getFinalPrice() != null ? t.getFinalPrice() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal dp = t.getDownpayment() != null ? t.getDownpayment() : java.math.BigDecimal.ZERO;
            return fp.subtract(dp);
        }));

        String reqMethod = body.containsKey("paymentMethod") ? body.get("paymentMethod").toString() : null;

        java.math.BigDecimal remainingPayment = amount;
        boolean updated = false;

        for (Transaction tx : itemsToPay) {
            if ("FULL".equalsIgnoreCase(tx.getStatus())) {
                continue;
            }

            if (reqMethod != null && !reqMethod.isBlank()) {
                tx.setPaymentMethod(reqMethod);
            }
            if (tx.getBranch() == null && tx.getConsignee() != null && tx.getConsignee().getBranch() != null) {
                tx.setBranch(tx.getConsignee().getBranch());
            }

            java.math.BigDecimal finalPrice = tx.getFinalPrice() != null ? tx.getFinalPrice() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal downpayment = tx.getDownpayment() != null ? tx.getDownpayment() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal balance = finalPrice.subtract(downpayment);

            if (balance.compareTo(java.math.BigDecimal.ZERO) <= 0) {
                tx.setStatus("FULL");
                transactionRepository.save(tx);
                continue;
            }

            if (remainingPayment.compareTo(java.math.BigDecimal.ZERO) <= 0) {
                break; // Payment amount exhausted
            }

            if (remainingPayment.compareTo(balance) >= 0) {
                // Fully pay this item
                BigDecimal paidAmount = balance;
                tx.setDownpayment(finalPrice);
                tx.setStatus("FULL");
                remainingPayment = remainingPayment.subtract(balance);
                updated = true;

                BigDecimal cost = tx.getCostPrice() != null ? tx.getCostPrice() : BigDecimal.ZERO;
                BigDecimal costPortion = finalPrice.compareTo(BigDecimal.ZERO) > 0
                        ? cost.multiply(paidAmount).divide(finalPrice, 2, java.math.RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;
                createPaymentLog(tx, paidAmount, costPortion, tx.getPaymentMethod());
            } else {
                // Partially pay this item
                BigDecimal paidAmount = remainingPayment;
                tx.setDownpayment(downpayment.add(remainingPayment));
                tx.setStatus("PARTIAL");
                remainingPayment = java.math.BigDecimal.ZERO;
                updated = true;

                BigDecimal cost = tx.getCostPrice() != null ? tx.getCostPrice() : BigDecimal.ZERO;
                BigDecimal costPortion = finalPrice.compareTo(BigDecimal.ZERO) > 0
                        ? cost.multiply(paidAmount).divide(finalPrice, 2, java.math.RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;
                createPaymentLog(tx, paidAmount, costPortion, tx.getPaymentMethod());
            }
            transactionRepository.save(tx);
        }

        return ResponseEntity.ok(Map.of("message", "Payment applied successfully."));
    }

    // ── Update final price of a transaction item (e.g., discounted/sale on consignment) ──
    @Transactional
    @PatchMapping("/{id}/price")
    public ResponseEntity<?> updatePrice(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        Transaction tx = transactionRepository.findByIdWithDetails(id).orElse(null);
        if (tx == null) {
            return ResponseEntity.notFound().build();
        }
        if (!body.containsKey("price")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Price is required."));
        }

        BigDecimal newPrice;
        try {
            newPrice = new BigDecimal(body.get("price").toString());
            if (newPrice.compareTo(BigDecimal.ZERO) < 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Price cannot be negative."));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid price format."));
        }

        BigDecimal downpayment = tx.getDownpayment() != null ? tx.getDownpayment() : BigDecimal.ZERO;
        if (newPrice.compareTo(downpayment) < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "New price cannot be lower than the already received downpayment of " + downpayment));
        }

        tx.setFinalPrice(newPrice);

        // Adjust status if needed based on the new price vs downpayment
        if ("FULL".equalsIgnoreCase(tx.getStatus())) {
            if (newPrice.compareTo(downpayment) > 0) {
                tx.setStatus("PARTIAL");
            }
        } else {
            if (newPrice.compareTo(downpayment) == 0 && downpayment.compareTo(BigDecimal.ZERO) > 0) {
                tx.setStatus("FULL");
            }
        }

        transactionRepository.save(tx);
        return ResponseEntity.ok(Map.of("message", "Price updated successfully.", "transactionId", id, "newPrice", newPrice));
    }

    // ── Return a single consignment item (restore stock, delete transaction row) ─
    @Transactional
    @DeleteMapping("/{id}/return")
    public ResponseEntity<?> returnItem(@PathVariable("id") Long id) {
        Transaction tx = transactionRepository.findByIdWithDetails(id).orElse(null);
        if (tx == null) {
            return ResponseEntity.notFound().build();
        }
        if (!"CONSIGNMENT".equals(tx.getTransactionType())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only CONSIGNMENT items can be returned."));
        }
        if ("FULL".equalsIgnoreCase(tx.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot return an already-paid item."));
        }

        // Restore stock to Admin Holding (branch_id = NULL).
        // Consigned items physically come back to the admin warehouse when returned.
        StockBatch batch = tx.getStockBatch();
        if (batch != null) {
            batch.setRemainingQuantity(batch.getRemainingQuantity() + 1);
            // Move the batch to Admin Holding — returned consigned stock is no longer at Cebu Main
            batch.setBranch(null);
            stockBatchRepository.save(batch);
        } else {
            // Fallback: find any holding batch (branch IS NULL) for this variant, or any batch
            ProductVariant variant = tx.getVariant();
            List<StockBatch> batches = stockBatchRepository.findReceivableForHoldingForUpdate(variant.getId());
            if (batches.isEmpty()) {
                // No holding batch exists — fall back to any received batch
                batches = stockBatchRepository.findByVariantIdAndStatusReceivedForUpdate(variant.getId());
            }
            if (!batches.isEmpty()) {
                StockBatch target = batches.get(0);
                target.setRemainingQuantity(target.getRemainingQuantity() + 1);
                target.setBranch(null); // ensure it lands in Admin Holding
                stockBatchRepository.save(target);
            }
        }

        transactionRepository.delete(tx);
        stockWebSocketHandler.broadcastStockUpdate();
        return ResponseEntity.ok(Map.of("message", "Item returned and stock restored.", "transactionId", id));
    }

    @Transactional
    @PostMapping("/cancel/{transactionId}")
    public ResponseEntity<?> cancelOrder(@PathVariable("transactionId") String transactionId) {
        // Delete all payment logs for this order
        paymentLogRepository.deleteByOrderId(transactionId);

        List<Transaction> group;
        if (transactionId.startsWith("LEGACY-")) {
            try {
                Long id = Long.parseLong(transactionId.replace("LEGACY-", ""));
                group = transactionRepository.findById(id).map(List::of).orElse(Collections.emptyList());
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid transaction ID format: " + transactionId));
            }
        } else {
            group = transactionRepository.findByTransactionId(transactionId);
        }

        if (group.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        for (Transaction tx : group) {
            boolean isConsigned = tx.isConsigned() || "CONSIGNMENT".equals(tx.getTransactionType());
            // 1. Restore the stock batch accurately
            StockBatch batch = tx.getStockBatch();
            
            if (batch != null) {
                // Ideal case: we know exactly which batch this unit came from.
                batch.setRemainingQuantity(batch.getRemainingQuantity() + 1);
                if (isConsigned) {
                    // Consigned cancelled orders return to Admin Holding
                    batch.setBranch(null);
                }
                stockBatchRepository.save(batch);
            } else {
                // Fallback for legacy transactions (null stockBatch):
                // Prefer a batch that actually had items consumed (remaining < quantity)
                // so we restore to the right cost/supplier context. Use PESSIMISTIC_WRITE
                // lock to prevent two concurrent cancels from double-restoring.
                ProductVariant variant = tx.getVariant();
                List<StockBatch> batches = stockBatchRepository
                    .findByVariantIdAndStatusReceivedForUpdate(variant.getId());
                
                StockBatch targetBatch = null;
                // First: find a batch that had items sold from it (remaining < quantity)
                for (StockBatch b : batches) {
                    int orig = b.getQuantity() != null ? b.getQuantity() : 0;
                    int rem  = b.getRemainingQuantity() != null ? b.getRemainingQuantity() : 0;
                    if (rem < orig) { targetBatch = b; break; }
                }
                // Second: fall back to the most recent batch if none were consumed
                if (targetBatch == null && !batches.isEmpty()) {
                    targetBatch = batches.get(0);
                }
                if (targetBatch != null) {
                    targetBatch.setRemainingQuantity(targetBatch.getRemainingQuantity() + 1);
                    if (isConsigned) {
                        targetBatch.setBranch(null);
                    }
                    stockBatchRepository.save(targetBatch);
                }
            }

            // 2. Delete the transaction row entirely (user wants deletion, not 'CANCELLED' status)
            transactionRepository.delete(tx);
        }

        stockWebSocketHandler.broadcastStockUpdate();
        return ResponseEntity.ok(Map.of("message", "Order completely erased and stock restored.", "transactionId", transactionId));
    }

    // ── Broadcast helper — called after order cancel to push stock refresh ────
    private void broadcastAfterCancel() {
        stockWebSocketHandler.broadcastStockUpdate();
    }

    // ── Helper: create a payment log entry ────────────────────────────────────
    private void createPaymentLog(Transaction tx, BigDecimal amount, BigDecimal costPortion, String paymentMethod) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return;

        PaymentLog log = new PaymentLog();
        log.setTransaction(tx);
        log.setOrderId(tx.getTransactionId() != null ? tx.getTransactionId() : "LEGACY-" + tx.getId());
        log.setAmount(amount);
        log.setCostPortion(costPortion);
        log.setPaymentMethod(paymentMethod != null ? paymentMethod : "Unknown");
        // paymentDate auto-set by @PrePersist
        paymentLogRepository.save(log);
    }
}