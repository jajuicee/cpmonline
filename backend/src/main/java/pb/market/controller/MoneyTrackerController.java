package pb.market.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import pb.market.entity.Branch;
import pb.market.entity.BranchStockAllocation;
import pb.market.entity.Expense;
import pb.market.entity.PaymentLog;
import pb.market.repository.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/money-tracker")
@RequiredArgsConstructor
public class MoneyTrackerController {

    private final TransactionRepository transactionRepository;
    private final PaymentLogRepository paymentLogRepository;
    private final ExpenseRepository expenseRepository;
    private final BranchRepository branchRepository;
    private final BranchStockAllocationRepository allocationRepository;

    private static final List<String> DIGITAL_METHODS = List.of(
            "GCash", "Maya", "GoTyme", "BDO", "BPI", "MBOS", "Credit Card", "QRPH"
    );

    @Transactional(readOnly = true)
    @GetMapping("/summary")
    public ResponseEntity<?> getMoneyTrackerSummary(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {

        if (user != null && "BRANCH".equals(user.getRole())) {
            branchId = user.getBranchId();
        }

        LocalDateTime fromDt = null;
        LocalDateTime toDt = null;
        if (from != null && !from.isBlank()) {
            try { fromDt = LocalDateTime.parse(from); } catch (Exception ignored) {}
        }
        if (to != null && !to.isBlank()) {
            try { toDt = LocalDateTime.parse(to); } catch (Exception ignored) {}
        }
        boolean hasDateFilter = (fromDt != null || toDt != null);
        LocalDateTime effectiveFrom = fromDt != null ? fromDt : LocalDateTime.of(2020, 1, 1, 0, 0);
        LocalDateTime effectiveTo = toDt != null ? toDt : LocalDateTime.now();

        List<Branch> branches = branchRepository.findAll().stream()
                .filter(b -> b.isActive() && (b.getName() == null || !b.getName().toLowerCase().contains("warehouse")))
                .toList();

        // ── 1. Fetch Sales Aggregates by Method ──────────────────────────────
        List<Object[]> salesByMethodRaw;
        if (hasDateFilter) {
            salesByMethodRaw = branchId == null
                    ? paymentLogRepository.sumAmountByMethodInRange(effectiveFrom, effectiveTo)
                    : paymentLogRepository.sumAmountByMethodInRangeByBranch(effectiveFrom, effectiveTo, branchId);
        } else {
            salesByMethodRaw = branchId == null
                    ? paymentLogRepository.sumAmountByMethodAll()
                    : paymentLogRepository.sumAmountByMethodByBranch(branchId);
        }

        Map<String, BigDecimal> salesByMethod = new HashMap<>();
        for (Object[] row : salesByMethodRaw) {
            if (row[0] != null && row[1] != null) {
                String method = normalizeMethodName((String) row[0]);
                BigDecimal amt = (BigDecimal) row[1];
                salesByMethod.merge(method, amt, BigDecimal::add);
            }
        }

        // ── 2. Fetch Expenses Aggregates by Payment Source ───────────────────
        List<Object[]> expensesBySourceRaw;
        if (hasDateFilter) {
            // Filter by date range and branch
            List<Expense> inRangeExpenses = branchId == null
                    ? expenseRepository.findByDateRange(effectiveFrom, effectiveTo)
                    : expenseRepository.findByDateRangeAndBranch(effectiveFrom, effectiveTo, branchId);
            expensesBySourceRaw = new ArrayList<>();
            Map<String, BigDecimal> tmp = new HashMap<>();
            for (Expense e : inRangeExpenses) {
                if (!"EXPENSE".equalsIgnoreCase(e.getType())) continue;
                String src = e.getPaymentSource() != null ? e.getPaymentSource() : "Cash Drawer";
                tmp.merge(src, e.getCost() != null ? e.getCost() : BigDecimal.ZERO, BigDecimal::add);
            }
            for (Map.Entry<String, BigDecimal> entry : tmp.entrySet()) {
                expensesBySourceRaw.add(new Object[]{entry.getKey(), entry.getValue()});
            }
        } else {
            expensesBySourceRaw = branchId == null
                    ? expenseRepository.sumExpensesByPaymentSourceAll()
                    : expenseRepository.sumExpensesByPaymentSourceByBranch(branchId);
        }

        Map<String, BigDecimal> expensesBySource = new HashMap<>();
        for (Object[] row : expensesBySourceRaw) {
            if (row[0] != null && row[1] != null) {
                String src = normalizeMethodName((String) row[0]);
                BigDecimal cost = (BigDecimal) row[1];
                expensesBySource.merge(src, cost, BigDecimal::add);
            }
        }

        // ── 3. Build Cash Drawers ────────────────────────────────────────────
        // Aggregate cash sales & expenses per branch and admin via optimized SQL
        Map<Long, BigDecimal> branchCashSales = new HashMap<>();
        List<Object[]> branchSalesRaw = hasDateFilter
                ? paymentLogRepository.sumCashSalesByBranchInRange(effectiveFrom, effectiveTo)
                : paymentLogRepository.sumCashSalesByBranchAll();
        for (Object[] row : branchSalesRaw) {
            if (row[0] != null && row[1] != null) {
                branchCashSales.put(((Number) row[0]).longValue(), (BigDecimal) row[1]);
            }
        }

        Map<Long, BigDecimal> branchCashExpenses = new HashMap<>();
        List<Object[]> branchExpRaw = hasDateFilter
                ? expenseRepository.sumCashExpensesByBranchInRange(effectiveFrom, effectiveTo)
                : expenseRepository.sumCashExpensesByBranchAll();
        for (Object[] row : branchExpRaw) {
            if (row[0] != null && row[1] != null) {
                branchCashExpenses.put(((Number) row[0]).longValue(), (BigDecimal) row[1]);
            }
        }

        BigDecimal adminCashSales = hasDateFilter
                ? paymentLogRepository.sumAdminCashSalesInRange(effectiveFrom, effectiveTo)
                : paymentLogRepository.sumAdminCashSalesAll();
        if (adminCashSales == null) adminCashSales = BigDecimal.ZERO;

        BigDecimal adminCashExpenses = hasDateFilter
                ? expenseRepository.sumAdminCashExpensesInRange(effectiveFrom, effectiveTo)
                : expenseRepository.sumAdminCashExpensesAll();
        if (adminCashExpenses == null) adminCashExpenses = BigDecimal.ZERO;

        List<Map<String, Object>> cashDrawers = new ArrayList<>();

        if (branchId == null) {
            // Central Admin Cash Drawer
            BigDecimal netAdminCash = adminCashSales.subtract(adminCashExpenses);
            Map<String, Object> adminDrawer = new LinkedHashMap<>();
            adminDrawer.put("id", "admin_drawer");
            adminDrawer.put("name", "Central Admin Drawer");
            adminDrawer.put("locationType", "ADMIN");
            adminDrawer.put("branchId", null);
            adminDrawer.put("cashSales", adminCashSales);
            adminDrawer.put("cashExpenses", adminCashExpenses);
            adminDrawer.put("currentBalance", netAdminCash);
            cashDrawers.add(adminDrawer);
        }

        for (Branch b : branches) {
            if (branchId != null && !b.getId().equals(branchId)) continue;

            BigDecimal bSales = branchCashSales.getOrDefault(b.getId(), BigDecimal.ZERO);
            BigDecimal bExp = branchCashExpenses.getOrDefault(b.getId(), BigDecimal.ZERO);
            BigDecimal bNet = bSales.subtract(bExp);

            Map<String, Object> drawer = new LinkedHashMap<>();
            drawer.put("id", "branch_drawer_" + b.getId());
            drawer.put("name", b.getName() + " Cash Drawer");
            drawer.put("locationType", "BRANCH");
            drawer.put("branchId", b.getId());
            drawer.put("branchName", b.getName());
            drawer.put("cashSales", bSales);
            drawer.put("cashExpenses", bExp);
            drawer.put("currentBalance", bNet);
            cashDrawers.add(drawer);
        }

        // ── 4. Build Digital & Bank Accounts ─────────────────────────────────
        List<Map<String, Object>> digitalAccounts = new ArrayList<>();
        Set<String> allDigitalKeys = new LinkedHashSet<>(DIGITAL_METHODS);
        allDigitalKeys.addAll(salesByMethod.keySet());
        allDigitalKeys.addAll(expensesBySource.keySet());
        allDigitalKeys.remove("Cash");

        BigDecimal totalDigitalInflow = BigDecimal.ZERO;
        BigDecimal totalDigitalOutflow = BigDecimal.ZERO;

        for (String methodKey : allDigitalKeys) {
            String norm = normalizeMethodName(methodKey);
            if ("Cash".equalsIgnoreCase(norm)) continue;

            BigDecimal inflow = salesByMethod.getOrDefault(norm, BigDecimal.ZERO);
            BigDecimal outflow = expensesBySource.getOrDefault(norm, BigDecimal.ZERO);
            BigDecimal net = inflow.subtract(outflow);

            totalDigitalInflow = totalDigitalInflow.add(inflow);
            totalDigitalOutflow = totalDigitalOutflow.add(outflow);

            String accType = "E_WALLET";
            if (List.of("BDO", "BPI", "GoTyme", "MBOS").contains(norm)) accType = "BANK";
            else if ("Credit Card".equalsIgnoreCase(norm) || "QRPH".equalsIgnoreCase(norm)) accType = "TERMINAL";

            Map<String, Object> acc = new LinkedHashMap<>();
            acc.put("methodName", norm);
            acc.put("accountType", accType);
            acc.put("inflow", inflow);
            acc.put("outflow", outflow);
            acc.put("currentBalance", net);
            digitalAccounts.add(acc);
        }

        // ── 5. Total Liquid Funds ────────────────────────────────────────────
        BigDecimal totalDrawerCash = cashDrawers.stream()
                .map(d -> (BigDecimal) d.get("currentBalance"))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalDigitalBalance = digitalAccounts.stream()
                .map(a -> (BigDecimal) a.get("currentBalance"))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalLiquidFunds = totalDrawerCash.add(totalDigitalBalance);

        // ── 6. Branch Allocation Dues (Accounts Receivable) ──────────────────
        List<BranchStockAllocation> allocations = allocationRepository.findAll();
        BigDecimal totalBranchDues = BigDecimal.ZERO;
        Map<Long, Map<String, Object>> branchDuesMap = new LinkedHashMap<>();

        for (Branch b : branches) {
            Map<String, Object> bm = new LinkedHashMap<>();
            bm.put("branchId", b.getId());
            bm.put("branchName", b.getName());
            bm.put("totalDispatched", BigDecimal.ZERO);
            bm.put("totalRemitted", BigDecimal.ZERO);
            bm.put("balanceDue", BigDecimal.ZERO);
            bm.put("overdueBatches", 0);
            branchDuesMap.put(b.getId(), bm);
        }

        for (BranchStockAllocation a : allocations) {
            if (a.getBranch() == null) continue;
            Long bId = a.getBranch().getId();
            Map<String, Object> bm = branchDuesMap.get(bId);
            if (bm == null) continue;

            BigDecimal cost = a.getTotalCost() != null ? a.getTotalCost() : BigDecimal.ZERO;
            BigDecimal paid = a.getAmountPaid() != null ? a.getAmountPaid() : BigDecimal.ZERO;
            BigDecimal rem = cost.subtract(paid);

            bm.put("totalDispatched", ((BigDecimal) bm.get("totalDispatched")).add(cost));
            bm.put("totalRemitted", ((BigDecimal) bm.get("totalRemitted")).add(paid));

            if (rem.compareTo(BigDecimal.ZERO) > 0) {
                bm.put("balanceDue", ((BigDecimal) bm.get("balanceDue")).add(rem));
                totalBranchDues = totalBranchDues.add(rem);

                if (a.getDeadline() != null && a.getDeadline().isBefore(java.time.LocalDate.now())) {
                    bm.put("overdueBatches", (Integer) bm.get("overdueBatches") + 1);
                }
            }
        }

        // ── 7. Customer Unpaid & Consignee Payables via Fast SQL Sums ────────
        BigDecimal totalConsigneePayables = transactionRepository.sumConsigneePayables();
        if (totalConsigneePayables == null) totalConsigneePayables = BigDecimal.ZERO;

        BigDecimal customerUnpaid = transactionRepository.sumCustomerUnpaid();
        if (customerUnpaid == null) customerUnpaid = BigDecimal.ZERO;

        // ── 8. Recent Combined Money Movements (Limit 15 each with eager fetch) ─
        List<Map<String, Object>> movements = new ArrayList<>();

        List<PaymentLog> recentLogs = (branchId == null)
                ? paymentLogRepository.findTopMovements(PageRequest.of(0, 15))
                : paymentLogRepository.findTopMovementsByBranch(branchId, PageRequest.of(0, 15));

        for (PaymentLog pl : recentLogs) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", "pay_" + pl.getId());
            m.put("type", "SALE");
            m.put("direction", "IN");
            m.put("amount", pl.getAmount());
            m.put("paymentMethod", normalizeMethodName(pl.getPaymentMethod()));
            m.put("timestamp", pl.getPaymentDate());
            m.put("description", "Customer POS Payment (" + pl.getOrderId() + ")");
            m.put("branchName", pl.getTransaction() != null && pl.getTransaction().getBranch() != null
                    ? pl.getTransaction().getBranch().getName()
                    : "Central Admin");
            movements.add(m);
        }

        List<Expense> recentExpenses = (branchId == null)
                ? expenseRepository.findTopMovements(PageRequest.of(0, 15))
                : expenseRepository.findTopMovementsByBranch(branchId, PageRequest.of(0, 15));

        for (Expense e : recentExpenses) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", "exp_" + e.getId());
            m.put("type", "EXPENSE".equalsIgnoreCase(e.getType()) ? "EXPENSE" : "INCOME");
            m.put("direction", "EXPENSE".equalsIgnoreCase(e.getType()) ? "OUT" : "IN");
            m.put("amount", e.getCost());
            m.put("paymentMethod", normalizeMethodName(e.getPaymentSource()));
            m.put("timestamp", e.getExpenseDate());
            m.put("description", e.getName() + (e.getCategory() != null ? " · " + e.getCategory() : ""));
            m.put("branchName", e.getBranch() != null ? e.getBranch().getName() : "Central Admin");
            movements.add(m);
        }

        // Sort movements by timestamp descending
        movements.sort((a, b) -> {
            LocalDateTime ta = (LocalDateTime) a.get("timestamp");
            LocalDateTime tb = (LocalDateTime) b.get("timestamp");
            if (ta == null && tb == null) return 0;
            if (ta == null) return 1;
            if (tb == null) return -1;
            return tb.compareTo(ta);
        });

        if (movements.size() > 30) {
            movements = movements.subList(0, 30);
        }

        // ── Package Response ─────────────────────────────────────────────────
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("totalLiquidFunds", totalLiquidFunds);
        response.put("totalCashInDrawers", totalDrawerCash);
        response.put("totalDigitalAndBankFunds", totalDigitalBalance);
        response.put("totalBranchDuesReceivable", totalBranchDues);
        response.put("totalCustomerUnpaidReceivable", customerUnpaid);
        response.put("totalConsigneePayables", totalConsigneePayables);

        response.put("cashDrawers", cashDrawers);
        response.put("digitalAccounts", digitalAccounts);
        response.put("branchDuesBreakdown", branchDuesMap.values());
        response.put("recentMovements", movements);

        return ResponseEntity.ok(response);
    }

    private static String normalizeMethodName(String method) {
        if (method == null || method.isBlank()) return "Cash";
        String m = method.trim();
        if (m.equalsIgnoreCase("cash drawer") || m.equalsIgnoreCase("cash")) return "Cash";
        if (m.equalsIgnoreCase("banko") || m.equalsIgnoreCase("bank transfer")) return "MBOS";
        if (m.equalsIgnoreCase("gcash")) return "GCash";
        if (m.equalsIgnoreCase("maya") || m.equalsIgnoreCase("paymaya")) return "Maya";
        if (m.equalsIgnoreCase("gotyme")) return "GoTyme";
        if (m.equalsIgnoreCase("bdo")) return "BDO";
        if (m.equalsIgnoreCase("bpi")) return "BPI";
        if (m.equalsIgnoreCase("credit card") || m.equalsIgnoreCase("card")) return "Credit Card";
        if (m.equalsIgnoreCase("qrph") || m.equalsIgnoreCase("qr ph")) return "QRPH";
        return m;
    }
}
