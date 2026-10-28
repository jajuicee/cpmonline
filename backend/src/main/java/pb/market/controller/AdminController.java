package pb.market.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import pb.market.entity.Branch;
import pb.market.entity.BranchStockAllocation;
import pb.market.entity.Role;
import pb.market.entity.Transaction;
import pb.market.entity.User;
import pb.market.repository.BranchRepository;
import pb.market.repository.BranchStockAllocationRepository;
import pb.market.repository.StockBatchRepository;
import pb.market.repository.TransactionRepository;
import pb.market.repository.UserRepository;

import org.springframework.data.domain.PageRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final BranchRepository branchRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TransactionRepository transactionRepository;
    private final StockBatchRepository stockBatchRepository;
    private final BranchStockAllocationRepository allocationRepository;

    public AdminController(
            BranchRepository branchRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            TransactionRepository transactionRepository,
            StockBatchRepository stockBatchRepository,
            BranchStockAllocationRepository allocationRepository) {
        this.branchRepository = branchRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.transactionRepository = transactionRepository;
        this.stockBatchRepository = stockBatchRepository;
        this.allocationRepository = allocationRepository;
    }

    // ─── BRANCH CRUD (Only Retail Branches) ─────────────────────────

    @GetMapping("/branches")
    public List<Branch> getAllBranches() {
        return branchRepository.findAll().stream()
                .filter(b -> b.isActive() && (b.getName() == null || !b.getName().toLowerCase().contains("warehouse")))
                .toList();
    }

    @GetMapping("/branches/{id}")
    public ResponseEntity<?> getBranchById(@PathVariable Long id) {
        return branchRepository.findById(id).map(b -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", b.getId());
            map.put("name", b.getName());
            map.put("address", b.getAddress());
            map.put("contactInfo", b.getContactInfo());
            map.put("active", b.isActive());
            map.put("priceChangePassword", b.getEffectivePriceChangePassword());

            java.time.LocalDateTime startOfToday = java.time.LocalDate.now().atStartOfDay();
            java.time.LocalDateTime endOfToday = startOfToday.plusDays(1);
            LocalDate today = LocalDate.now();

            java.math.BigDecimal totalRev = transactionRepository.sumFinalPriceAllByBranch(b.getId());
            java.math.BigDecimal todayRev = transactionRepository.sumFinalPriceInRangeAndBranch(startOfToday, endOfToday, b.getId());

            List<Object[]> stockRows = stockBatchRepository.sumRemainingQuantityByVariantIdAndBranch(b.getId());
            long totalStockUnits = stockRows.stream().mapToLong(r -> r[1] != null ? ((Number) r[1]).longValue() : 0L).sum();

            BigDecimal outstanding = allocationRepository.sumOutstandingByBranchId(b.getId());
            List<BranchStockAllocation> overdueList = allocationRepository.findOverdueByBranch(b.getId(), today);

            map.put("totalRevenue", totalRev != null ? totalRev : BigDecimal.ZERO);
            map.put("todayRevenue", todayRev != null ? todayRev : BigDecimal.ZERO);
            map.put("totalStockUnits", totalStockUnits);
            map.put("totalDue", outstanding != null ? outstanding : BigDecimal.ZERO);
            map.put("overdueCount", overdueList != null ? overdueList.size() : 0);

            return ResponseEntity.ok(map);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/branches")
    public Branch createBranch(@RequestBody Branch branch) {
        if (branch.getPriceChangePassword() == null || branch.getPriceChangePassword().trim().isEmpty()) {
            branch.setPriceChangePassword("admin123");
        }
        return branchRepository.save(branch);
    }

    @PutMapping("/branches/{id}")
    public ResponseEntity<?> updateBranch(@PathVariable Long id, @RequestBody Branch updated) {
        return branchRepository.findById(id)
                .map(branch -> {
                    branch.setName(updated.getName());
                    branch.setAddress(updated.getAddress());
                    branch.setContactInfo(updated.getContactInfo());
                    branch.setActive(updated.isActive());
                    if (updated.getPriceChangePassword() != null && !updated.getPriceChangePassword().trim().isEmpty()) {
                        branch.setPriceChangePassword(updated.getPriceChangePassword().trim());
                    }
                    return ResponseEntity.ok(branchRepository.save(branch));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @org.springframework.transaction.annotation.Transactional
    @DeleteMapping("/branches/{id}")
    public ResponseEntity<?> deleteBranch(@PathVariable Long id) {
        if (!branchRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        // Return all stock batches to Master Storage (Admin Holding Pool)
        entityManager.createNativeQuery("UPDATE stock_batches SET branch_id = NULL WHERE branch_id = :id")
                .setParameter("id", id).executeUpdate();

        // Safely detach all references so historical orders/records are not lost
        entityManager.createNativeQuery("UPDATE consignees SET branch_id = NULL WHERE branch_id = :id")
                .setParameter("id", id).executeUpdate();
        entityManager.createNativeQuery("UPDATE transactions SET branch_id = NULL WHERE branch_id = :id")
                .setParameter("id", id).executeUpdate();
        entityManager.createNativeQuery("UPDATE users SET branch_id = NULL WHERE branch_id = :id")
                .setParameter("id", id).executeUpdate();
        entityManager.createNativeQuery("UPDATE expenses SET branch_id = NULL WHERE branch_id = :id")
                .setParameter("id", id).executeUpdate();
        entityManager.createNativeQuery("UPDATE stock_adjustments SET branch_id = NULL WHERE branch_id = :id")
                .setParameter("id", id).executeUpdate();

        // Clean up branch allocations and branch selling prices
        entityManager.createNativeQuery("DELETE FROM branch_stock_allocations WHERE branch_id = :id")
                .setParameter("id", id).executeUpdate();
        entityManager.createNativeQuery("DELETE FROM branch_selling_prices WHERE branch_id = :id")
                .setParameter("id", id).executeUpdate();

        // Permanently delete the branch
        entityManager.createNativeQuery("DELETE FROM branches WHERE id = :id")
                .setParameter("id", id).executeUpdate();

        return ResponseEntity.ok(Map.of("message", "Branch deleted successfully and all items returned to Master Storage."));
    }

    @GetMapping("/branches/overview")
    public List<Map<String, Object>> getBranchesOverview() {
        java.time.LocalDateTime startOfToday = java.time.LocalDate.now().atStartOfDay();
        java.time.LocalDateTime endOfToday = startOfToday.plusDays(1);
        LocalDate today = LocalDate.now();

        // Pre-fetch dues data for all branches
        Map<Long, BigDecimal> outstandingMap = new java.util.HashMap<>();
        Map<Long, BigDecimal> paidMap = new java.util.HashMap<>();
        Map<Long, Long> overdueMap = new java.util.HashMap<>();
        try {
            allocationRepository.sumOutstandingPerBranch().forEach(row ->
                outstandingMap.put(((Number) row[0]).longValue(), (BigDecimal) row[1]));
            allocationRepository.countOverdueByBranch(today).forEach(row ->
                overdueMap.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue()));
        } catch (Exception ignored) { /* table may not exist yet on first startup */ }

        return branchRepository.findAll().stream()
                .filter(b -> b.isActive() && (b.getName() == null || !b.getName().toLowerCase().contains("warehouse")))
                .map(b -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", b.getId());
                    map.put("name", b.getName());
                    map.put("address", b.getAddress());
                    map.put("contactInfo", b.getContactInfo());
                    map.put("active", b.isActive());
                    map.put("priceChangePassword", b.getEffectivePriceChangePassword());

                    // Aggregates
                    java.math.BigDecimal totalRev = transactionRepository.sumFinalPriceAllByBranch(b.getId());
                    java.math.BigDecimal todayRev = transactionRepository.sumFinalPriceInRangeAndBranch(startOfToday, endOfToday, b.getId());

                    // Stock remaining units
                    List<Object[]> stockRows = stockBatchRepository.sumRemainingQuantityByVariantIdAndBranch(b.getId());
                    long totalStockUnits = stockRows.stream().mapToLong(r -> r[1] != null ? ((Number) r[1]).longValue() : 0L).sum();

                    map.put("totalRevenue", totalRev != null ? totalRev : java.math.BigDecimal.ZERO);
                    map.put("todayRevenue", todayRev != null ? todayRev : java.math.BigDecimal.ZERO);
                    map.put("totalStockUnits", totalStockUnits);
                    map.put("isWarehouse", false);
                    map.put("totalDue", outstandingMap.getOrDefault(b.getId(), BigDecimal.ZERO));
                    map.put("overdueCount", overdueMap.getOrDefault(b.getId(), 0L));

                    return map;
                }).toList();
    }

    // ─── USER CRUD ────────────────────────────────────────────────

    @GetMapping("/users")
    public List<Map<String, Object>> getAllUsers() {
        return userRepository.findAll().stream().map(u -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", u.getId());
            map.put("username", u.getUsername());
            map.put("role", u.getRole().name());
            map.put("branchId", u.getBranch() != null ? u.getBranch().getId() : null);
            map.put("branchName", u.getBranch() != null ? u.getBranch().getName() : null);
            map.put("active", u.isActive());
            map.put("lastLogin", u.getLastLogin() != null ? u.getLastLogin().toString() : null);
            return map;
        }).toList();
    }

    @PostMapping("/users")
    public ResponseEntity<?> createUser(@RequestBody Map<String, Object> body) {
        String username = (String) body.get("username");
        String password = (String) body.get("password");
        String roleStr = (String) body.get("role");
        Object branchIdObj = body.get("branchId");

        if (username == null || password == null || roleStr == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "username, password, and role are required"));
        }

        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username already exists"));
        }

        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(Role.valueOf(roleStr.toUpperCase()));

        if (branchIdObj != null && !branchIdObj.toString().isEmpty()) {
            Long branchId = Long.valueOf(branchIdObj.toString());
            branchRepository.findById(branchId).ifPresent(user::setBranch);
        }

        userRepository.save(user);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("id", user.getId());
        resp.put("username", user.getUsername());
        resp.put("role", user.getRole().name());
        return ResponseEntity.ok(resp);
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return userRepository.findById(id)
                .map(user -> {
                    if (body.containsKey("username")) user.setUsername((String) body.get("username"));
                    if (body.containsKey("password") && body.get("password") != null && !body.get("password").toString().isEmpty()) {
                        user.setPasswordHash(passwordEncoder.encode(body.get("password").toString()));
                    }
                    if (body.containsKey("role")) user.setRole(Role.valueOf(body.get("role").toString().toUpperCase()));
                    if (body.containsKey("active")) user.setActive(Boolean.parseBoolean(body.get("active").toString()));
                    if (body.containsKey("branchId")) {
                        Object branchIdObj = body.get("branchId");
                        if (branchIdObj != null && !branchIdObj.toString().isEmpty()) {
                            branchRepository.findById(Long.valueOf(branchIdObj.toString())).ifPresent(user::setBranch);
                        } else {
                            user.setBranch(null);
                        }
                    }
                    userRepository.save(user);
                    return ResponseEntity.ok(Map.of("message", "User updated"));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "User deleted"));
    }

    // ─── REMITTABLE SALES PER BRANCH ──────────────────────────────────────────
    /**
     * Returns an itemized breakdown of all items sold at a specific branch,
     * including selling price, cost price (remittable wholesale base to Admin),
     * branch profit margin, and current remittance status.
     */
    @GetMapping("/branches/{branchId}/remittable-sales")
    public ResponseEntity<?> getBranchRemittableSales(
            @PathVariable Long branchId,
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to", required = false) String toStr) {

        Branch branch = branchRepository.findById(branchId).orElse(null);
        if (branch == null) {
            return ResponseEntity.notFound().build();
        }

        LocalDateTime fromDt = parseDateTime(fromStr, false);
        LocalDateTime toDt = parseDateTime(toStr, true);

        PageRequest page = PageRequest.of(0, 50000);
        List<Transaction> transactions;
        if (fromDt != null && toDt != null) {
            transactions = transactionRepository.findAllWithDetailsByActivityDateAndBranch(fromDt, toDt, branchId, page);
        } else {
            transactions = transactionRepository.findAllWithDetailsByBranch(branchId, page);
        }

        // Fetch allocations for this branch to correlate stock batches and remittance status
        List<BranchStockAllocation> allocations = allocationRepository.findByBranchIdOrderByAllocatedAtDesc(branchId);
        Map<Long, BranchStockAllocation> batchToAllocation = new java.util.HashMap<>();
        Map<Long, List<BranchStockAllocation>> variantToAllocations = new java.util.HashMap<>();
        for (BranchStockAllocation a : allocations) {
            if (a.getStockBatchId() != null) {
                batchToAllocation.put(a.getStockBatchId(), a);
            }
            if (a.getVariant() != null && a.getVariant().getId() != null) {
                variantToAllocations.computeIfAbsent(a.getVariant().getId(), k -> new java.util.ArrayList<>()).add(a);
            }
        }

        BigDecimal totalGrossSales = BigDecimal.ZERO;
        BigDecimal totalCollected = BigDecimal.ZERO;
        BigDecimal totalRemittable = BigDecimal.ZERO;
        BigDecimal totalRemitted = BigDecimal.ZERO;
        int totalItemsSold = 0;

        List<Map<String, Object>> items = new java.util.ArrayList<>();

        for (Transaction t : transactions) {
            BigDecimal finalPrice = t.getFinalPrice() != null ? t.getFinalPrice() : BigDecimal.ZERO;
            BigDecimal downpayment = t.getDownpayment() != null ? t.getDownpayment() : BigDecimal.ZERO;
            BigDecimal costPrice = t.getCostPrice() != null ? t.getCostPrice() : BigDecimal.ZERO;
            BigDecimal profit = finalPrice.subtract(costPrice);
            double profitMargin = finalPrice.compareTo(BigDecimal.ZERO) > 0
                    ? profit.multiply(BigDecimal.valueOf(100)).divide(finalPrice, 2, java.math.RoundingMode.HALF_UP).doubleValue()
                    : 0.0;

            // Correlate remittance status with allocation record
            BranchStockAllocation alloc = null;
            if (t.getStockBatch() != null && t.getStockBatch().getId() != null) {
                alloc = batchToAllocation.get(t.getStockBatch().getId());
            }
            if (alloc == null && t.getVariant() != null && variantToAllocations.containsKey(t.getVariant().getId())) {
                List<BranchStockAllocation> vAllocs = variantToAllocations.get(t.getVariant().getId());
                if (!vAllocs.isEmpty()) {
                    alloc = vAllocs.get(0);
                }
            }

            String remittanceStatus;
            BigDecimal remittedPortion;
            BigDecimal pendingPortion;

            if (alloc != null) {
                if ("PAID".equalsIgnoreCase(alloc.getStatus())) {
                    remittanceStatus = "REMITTED";
                    remittedPortion = costPrice;
                    pendingPortion = BigDecimal.ZERO;
                } else if ("PARTIAL".equalsIgnoreCase(alloc.getStatus()) && alloc.getTotalCost() != null && alloc.getTotalCost().compareTo(BigDecimal.ZERO) > 0) {
                    remittanceStatus = "PARTIAL";
                    BigDecimal paidRatio = alloc.getAmountPaid().divide(alloc.getTotalCost(), 4, java.math.RoundingMode.HALF_UP);
                    remittedPortion = costPrice.multiply(paidRatio).setScale(2, java.math.RoundingMode.HALF_UP);
                    if (remittedPortion.compareTo(costPrice) > 0) remittedPortion = costPrice;
                    pendingPortion = costPrice.subtract(remittedPortion);
                } else {
                    remittanceStatus = "PENDING";
                    remittedPortion = BigDecimal.ZERO;
                    pendingPortion = costPrice;
                }
            } else {
                remittanceStatus = "PENDING";
                remittedPortion = BigDecimal.ZERO;
                pendingPortion = costPrice;
            }

            totalGrossSales = totalGrossSales.add(finalPrice);
            totalCollected = totalCollected.add(downpayment);
            totalRemittable = totalRemittable.add(costPrice);
            totalRemitted = totalRemitted.add(remittedPortion);
            totalItemsSold++;

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", t.getId());
            item.put("orderTicketId", t.getTransactionId());
            item.put("transactionDate", t.getTransactionDate() != null ? t.getTransactionDate().toString() : null);
            item.put("customerName", t.getCustomerName());
            item.put("paymentMethod", t.getPaymentMethod());
            item.put("paymentDetails", t.getPaymentDetails());
            item.put("notes", t.getNotes());
            item.put("status", t.getStatus());
            item.put("finalPrice", finalPrice);
            item.put("downpayment", downpayment);
            item.put("costPrice", costPrice);
            item.put("remittableCost", costPrice);
            item.put("branchProfit", profit);
            item.put("profitMarginPct", profitMargin);
            item.put("remittanceStatus", remittanceStatus);
            item.put("remittedAmount", remittedPortion);
            item.put("pendingRemittance", pendingPortion);

            if (alloc != null) {
                item.put("allocationId", alloc.getId());
                item.put("adminBatchId", alloc.getAdminBatchId());
                item.put("allocationStatus", alloc.getStatus());
                item.put("allocationDeadline", alloc.getDeadline() != null ? alloc.getDeadline().toString() : null);
                item.put("allocationCostPerUnit", alloc.getCostPerUnit());
                item.put("allocationTotalCost", alloc.getTotalCost());
                item.put("allocationAmountPaid", alloc.getAmountPaid());
            } else {
                item.put("allocationId", null);
                item.put("adminBatchId", null);
                item.put("allocationStatus", null);
                item.put("allocationDeadline", null);
                item.put("allocationCostPerUnit", null);
                item.put("allocationTotalCost", null);
                item.put("allocationAmountPaid", null);
            }

            if (t.getVariant() != null) {
                Map<String, Object> vMap = new LinkedHashMap<>();
                vMap.put("id", t.getVariant().getId());
                vMap.put("sku", t.getVariant().getSku());
                vMap.put("color", t.getVariant().getColor());
                vMap.put("shape", t.getVariant().getShape());
                vMap.put("thicknessMm", t.getVariant().getThicknessMm());
                if (t.getVariant().getProduct() != null) {
                    vMap.put("brandName", t.getVariant().getProduct().getBrandName());
                    vMap.put("modelName", t.getVariant().getProduct().getModelName());
                    vMap.put("category", t.getVariant().getProduct().getCategory());
                }
                item.put("variant", vMap);
            } else {
                item.put("variant", null);
            }

            items.add(item);
        }

        BigDecimal pendingRemittance = totalRemittable.subtract(totalRemitted);
        BigDecimal totalBranchProfit = totalGrossSales.subtract(totalRemittable);
        double overallMargin = totalGrossSales.compareTo(BigDecimal.ZERO) > 0
                ? totalBranchProfit.multiply(BigDecimal.valueOf(100)).divide(totalGrossSales, 2, java.math.RoundingMode.HALF_UP).doubleValue()
                : 0.0;

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalItemsSold", totalItemsSold);
        summary.put("totalGrossSales", totalGrossSales);
        summary.put("totalCollected", totalCollected);
        summary.put("totalRemittable", totalRemittable);
        summary.put("totalRemitted", totalRemitted);
        summary.put("pendingRemittance", pendingRemittance);
        summary.put("totalBranchProfit", totalBranchProfit);
        summary.put("overallProfitMargin", overallMargin);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("branchId", branch.getId());
        response.put("branchName", branch.getName());
        response.put("summary", summary);
        response.put("items", items);

        return ResponseEntity.ok(response);
    }

    private LocalDateTime parseDateTime(String str, boolean isEnd) {
        if (str == null || str.isBlank()) return null;
        try {
            if (str.length() == 10) {
                LocalDate ld = LocalDate.parse(str);
                return isEnd ? ld.atTime(23, 59, 59) : ld.atStartOfDay();
            }
            return LocalDateTime.parse(str);
        } catch (Exception e) {
            return null;
        }
    }

    // ─── GET /api/admin/analytics/hq-direct & /api/admin/analytics/main-admin ──
    // Comprehensive Analytics for Main Admin: Direct Shop + Consignee Network
    @GetMapping({"/analytics/hq-direct", "/analytics/main-admin"})
    public ResponseEntity<?> getHqDirectAnalytics(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "ALL") String scope) {

        LocalDateTime fromDt = parseDateTime(from, false);
        LocalDateTime toDt = parseDateTime(to, true);

        org.springframework.data.domain.Pageable page = org.springframework.data.domain.PageRequest.of(0, 50000);
        List<Transaction> txs;
        if (fromDt != null && toDt != null) {
            txs = transactionRepository.findAllMainAdminTransactionsInRange(fromDt, toDt, page);
        } else {
            txs = transactionRepository.findAllMainAdminTransactions(page);
        }

        // Direct Shop metrics
        BigDecimal shopRevenue = BigDecimal.ZERO;
        BigDecimal shopCost = BigDecimal.ZERO;
        BigDecimal shopProfit = BigDecimal.ZERO;
        int shopUnits = 0;
        Map<String, BigDecimal> shopPaymentMethods = new LinkedHashMap<>();

        // Consignee Network metrics
        BigDecimal consigneeTotalValue = BigDecimal.ZERO;
        BigDecimal consigneeCollected = BigDecimal.ZERO;
        BigDecimal consigneePendingBalance = BigDecimal.ZERO;
        BigDecimal consigneeCost = BigDecimal.ZERO;
        BigDecimal consigneeRealizedProfit = BigDecimal.ZERO;
        int consigneeTotalUnits = 0;
        int consigneeUnitsPaid = 0;
        int consigneeUnitsPending = 0;

        Map<String, Map<String, Object>> consigneesMap = new LinkedHashMap<>();
        Map<String, Object[]> productsMap = new LinkedHashMap<>();
        Map<String, Map<String, BigDecimal>> dailyTrendMap = new TreeMap<>();
        List<Map<String, Object>> recentActivity = new ArrayList<>();

        for (Transaction t : txs) {
            boolean isConsignment = "CONSIGNMENT".equalsIgnoreCase(t.getTransactionType()) || t.getConsignee() != null;
            BigDecimal finalPrice = t.getFinalPrice() != null ? t.getFinalPrice() : BigDecimal.ZERO;
            BigDecimal costPrice = t.getCostPrice() != null ? t.getCostPrice() : BigDecimal.ZERO;
            BigDecimal downpayment = t.getDownpayment() != null ? t.getDownpayment() : BigDecimal.ZERO;

            if (!isConsignment) {
                if ("UNPAID".equalsIgnoreCase(t.getStatus()) && downpayment.compareTo(BigDecimal.ZERO) == 0) continue;

                shopRevenue = shopRevenue.add(finalPrice);
                shopCost = shopCost.add(costPrice);
                BigDecimal profit = finalPrice.subtract(costPrice);
                shopProfit = shopProfit.add(profit);
                shopUnits++;

                String pm = t.getPaymentMethod() != null ? t.getPaymentMethod() : "OTHER";
                shopPaymentMethods.put(pm, shopPaymentMethods.getOrDefault(pm, BigDecimal.ZERO).add(finalPrice));

                if (t.getVariant() != null) {
                    String sku = t.getVariant().getSku();
                    String name = (t.getVariant().getProduct() != null ? t.getVariant().getProduct().getBrandName() + " " + t.getVariant().getProduct().getModelName() : sku);
                    Object[] pArr = productsMap.computeIfAbsent(sku, k -> new Object[]{name, 0, 0, BigDecimal.ZERO, BigDecimal.ZERO});
                    pArr[1] = ((int) pArr[1]) + 1;
                    pArr[3] = ((BigDecimal) pArr[3]).add(finalPrice);
                    pArr[4] = ((BigDecimal) pArr[4]).add(profit);
                }

                if (t.getTransactionDate() != null) {
                    String dayKey = t.getTransactionDate().toLocalDate().toString();
                    Map<String, BigDecimal> day = dailyTrendMap.computeIfAbsent(dayKey, k -> new HashMap<>());
                    day.put("shopRevenue", day.getOrDefault("shopRevenue", BigDecimal.ZERO).add(finalPrice));
                    day.put("totalInflow", day.getOrDefault("totalInflow", BigDecimal.ZERO).add(finalPrice));
                }

                Map<String, Object> act = new LinkedHashMap<>();
                act.put("id", t.getId());
                act.put("orderId", t.getTransactionId() != null ? t.getTransactionId() : "TX-" + t.getId());
                act.put("date", t.getTransactionDate());
                act.put("type", "SHOP");
                act.put("entityName", t.getCustomerName() != null && !t.getCustomerName().isBlank() ? t.getCustomerName() : "Walk-in Customer");
                act.put("productName", t.getVariant() != null && t.getVariant().getProduct() != null ? t.getVariant().getProduct().getBrandName() + " " + t.getVariant().getProduct().getModelName() : "Item");
                act.put("sku", t.getVariant() != null ? t.getVariant().getSku() : "—");
                act.put("finalPrice", finalPrice);
                act.put("paidAmount", finalPrice);
                act.put("balanceDue", BigDecimal.ZERO);
                act.put("profit", profit);
                act.put("status", t.getStatus());
                act.put("paymentMethod", t.getPaymentMethod());
                recentActivity.add(act);

            } else {
                consigneeTotalUnits++;
                consigneeTotalValue = consigneeTotalValue.add(finalPrice);
                consigneeCost = consigneeCost.add(costPrice);

                BigDecimal collected = "FULL".equalsIgnoreCase(t.getStatus()) ? finalPrice : downpayment;
                consigneeCollected = consigneeCollected.add(collected);

                BigDecimal balanceDue = finalPrice.subtract(collected);
                if (balanceDue.compareTo(BigDecimal.ZERO) < 0) balanceDue = BigDecimal.ZERO;
                consigneePendingBalance = consigneePendingBalance.add(balanceDue);

                if ("FULL".equalsIgnoreCase(t.getStatus())) {
                    consigneeUnitsPaid++;
                } else {
                    consigneeUnitsPending++;
                }

                BigDecimal unitProfit = finalPrice.subtract(costPrice);
                BigDecimal realizedP = BigDecimal.ZERO;
                if (finalPrice.compareTo(BigDecimal.ZERO) > 0 && unitProfit.compareTo(BigDecimal.ZERO) > 0) {
                    realizedP = unitProfit.multiply(collected).divide(finalPrice, 2, java.math.RoundingMode.HALF_UP);
                }
                consigneeRealizedProfit = consigneeRealizedProfit.add(realizedP);

                String cName = t.getConsignee() != null ? t.getConsignee().getName() : (t.getCustomerName() != null ? t.getCustomerName() : "Consignee");
                Long cId = t.getConsignee() != null ? t.getConsignee().getId() : 0L;
                String cContact = t.getConsignee() != null ? t.getConsignee().getContactInfo() : "";

                Map<String, Object> cMap = consigneesMap.computeIfAbsent(cName, k -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", cId);
                    m.put("name", cName);
                    m.put("contactInfo", cContact != null ? cContact : "");
                    m.put("totalUnits", 0);
                    m.put("unitsPaid", 0);
                    m.put("unitsPending", 0);
                    m.put("totalValue", BigDecimal.ZERO);
                    m.put("amountPaid", BigDecimal.ZERO);
                    m.put("balanceDue", BigDecimal.ZERO);
                    m.put("realizedProfit", BigDecimal.ZERO);
                    return m;
                });
                cMap.put("totalUnits", (int) cMap.get("totalUnits") + 1);
                if ("FULL".equalsIgnoreCase(t.getStatus())) {
                    cMap.put("unitsPaid", (int) cMap.get("unitsPaid") + 1);
                } else {
                    cMap.put("unitsPending", (int) cMap.get("unitsPending") + 1);
                }
                cMap.put("totalValue", ((BigDecimal) cMap.get("totalValue")).add(finalPrice));
                cMap.put("amountPaid", ((BigDecimal) cMap.get("amountPaid")).add(collected));
                cMap.put("balanceDue", ((BigDecimal) cMap.get("balanceDue")).add(balanceDue));
                cMap.put("realizedProfit", ((BigDecimal) cMap.get("realizedProfit")).add(realizedP));

                if (t.getVariant() != null) {
                    String sku = t.getVariant().getSku();
                    String name = (t.getVariant().getProduct() != null ? t.getVariant().getProduct().getBrandName() + " " + t.getVariant().getProduct().getModelName() : sku);
                    Object[] pArr = productsMap.computeIfAbsent(sku, k -> new Object[]{name, 0, 0, BigDecimal.ZERO, BigDecimal.ZERO});
                    pArr[2] = ((int) pArr[2]) + 1;
                    pArr[3] = ((BigDecimal) pArr[3]).add(finalPrice);
                    pArr[4] = ((BigDecimal) pArr[4]).add(realizedP);
                }

                if (t.getTransactionDate() != null) {
                    String dayKey = t.getTransactionDate().toLocalDate().toString();
                    Map<String, BigDecimal> day = dailyTrendMap.computeIfAbsent(dayKey, k -> new HashMap<>());
                    day.put("consigneeCollected", day.getOrDefault("consigneeCollected", BigDecimal.ZERO).add(collected));
                    day.put("totalInflow", day.getOrDefault("totalInflow", BigDecimal.ZERO).add(collected));
                }

                Map<String, Object> act = new LinkedHashMap<>();
                act.put("id", t.getId());
                act.put("orderId", t.getTransactionId() != null ? t.getTransactionId() : "TX-" + t.getId());
                act.put("date", t.getTransactionDate());
                act.put("type", "CONSIGNMENT");
                act.put("entityName", cName + " (Consignee)");
                act.put("productName", t.getVariant() != null && t.getVariant().getProduct() != null ? t.getVariant().getProduct().getBrandName() + " " + t.getVariant().getProduct().getModelName() : "Item");
                act.put("sku", t.getVariant() != null ? t.getVariant().getSku() : "—");
                act.put("finalPrice", finalPrice);
                act.put("paidAmount", collected);
                act.put("balanceDue", balanceDue);
                act.put("profit", realizedP);
                act.put("status", t.getStatus());
                act.put("paymentMethod", t.getPaymentMethod());
                recentActivity.add(act);
            }
        }

        BigDecimal combinedInflow = shopRevenue.add(consigneeCollected);
        BigDecimal combinedGrossProfit = shopProfit.add(consigneeRealizedProfit);
        int combinedTotalUnits = shopUnits + consigneeTotalUnits;
        BigDecimal combinedValue = shopRevenue.add(consigneeTotalValue);

        BigDecimal shopMarginPct = shopRevenue.compareTo(BigDecimal.ZERO) > 0
                ? shopProfit.divide(shopRevenue, 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        BigDecimal combinedMarginPct = combinedInflow.compareTo(BigDecimal.ZERO) > 0
                ? combinedGrossProfit.divide(combinedInflow, 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("combinedInflow", combinedInflow);
        summary.put("combinedGrossProfit", combinedGrossProfit);
        summary.put("combinedMarginPct", combinedMarginPct);
        summary.put("combinedTotalUnits", combinedTotalUnits);
        summary.put("combinedValue", combinedValue);

        summary.put("shopRevenue", shopRevenue);
        summary.put("shopCost", shopCost);
        summary.put("shopProfit", shopProfit);
        summary.put("shopMarginPct", shopMarginPct);
        summary.put("shopUnitsSold", shopUnits);

        summary.put("consigneeTotalValue", consigneeTotalValue);
        summary.put("consigneeCollected", consigneeCollected);
        summary.put("consigneePendingBalance", consigneePendingBalance);
        summary.put("consigneeCost", consigneeCost);
        summary.put("consigneeRealizedProfit", consigneeRealizedProfit);
        summary.put("consigneeTotalUnits", consigneeTotalUnits);
        summary.put("consigneeUnitsPaid", consigneeUnitsPaid);
        summary.put("consigneeUnitsPending", consigneeUnitsPending);

        summary.put("totalRevenue", shopRevenue);
        summary.put("totalCost", shopCost);
        summary.put("grossProfit", shopProfit);
        summary.put("marginPct", shopMarginPct);
        summary.put("unitsSold", shopUnits);

        List<Map<String, Object>> consigneesList = consigneesMap.values().stream()
                .map(cm -> {
                    BigDecimal tv = (BigDecimal) cm.get("totalValue");
                    BigDecimal ap = (BigDecimal) cm.get("amountPaid");
                    double rate = tv.compareTo(BigDecimal.ZERO) > 0
                            ? ap.multiply(BigDecimal.valueOf(100)).divide(tv, 1, java.math.RoundingMode.HALF_UP).doubleValue()
                            : 0.0;
                    cm.put("settlementRatePct", rate);
                    return cm;
                })
                .sorted((a, b) -> ((BigDecimal) b.get("balanceDue")).compareTo((BigDecimal) a.get("balanceDue")))
                .toList();

        List<Map<String, Object>> topProducts = productsMap.entrySet().stream()
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("sku", e.getKey());
                    m.put("name", e.getValue()[0]);
                    m.put("shopUnits", e.getValue()[1]);
                    m.put("consigneeUnits", e.getValue()[2]);
                    m.put("totalUnits", ((int) e.getValue()[1]) + ((int) e.getValue()[2]));
                    m.put("units", ((int) e.getValue()[1]) + ((int) e.getValue()[2]));
                    m.put("revenue", e.getValue()[3]);
                    m.put("profit", e.getValue()[4]);
                    return m;
                })
                .sorted((a, b) -> ((BigDecimal) b.get("revenue")).compareTo((BigDecimal) a.get("revenue")))
                .toList();

        List<Map<String, Object>> trend = dailyTrendMap.entrySet().stream()
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("date", e.getKey());
                    m.put("shopRevenue", e.getValue().getOrDefault("shopRevenue", BigDecimal.ZERO));
                    m.put("consigneeCollected", e.getValue().getOrDefault("consigneeCollected", BigDecimal.ZERO));
                    m.put("revenue", e.getValue().getOrDefault("totalInflow", BigDecimal.ZERO));
                    m.put("totalInflow", e.getValue().getOrDefault("totalInflow", BigDecimal.ZERO));
                    return m;
                })
                .toList();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("summary", summary);
        res.put("consignees", consigneesList);
        res.put("paymentMethods", shopPaymentMethods);
        res.put("topProducts", topProducts);
        res.put("trend", trend);
        res.put("recentActivity", recentActivity);
        res.put("totalTransactionsCount", txs.size());

        return ResponseEntity.ok(res);
    }

    // ─── GET /api/admin/analytics/partner ──────────────────────────────────────
    // Dedicated Analytics for partnered & co-owned products (e.g. Pickle Gear 50/50 split)
    @GetMapping("/analytics/partner")
    public ResponseEntity<?> getPartnerAnalytics(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String partnerName) {

        LocalDateTime fromDt = parseDateTime(from, false);
        LocalDateTime toDt = parseDateTime(to, true);

        org.springframework.data.domain.Pageable page = org.springframework.data.domain.PageRequest.of(0, 50000);
        List<Transaction> txs;
        if (fromDt != null && toDt != null) {
            txs = transactionRepository.findAllPartnerWithDetailsInRange(fromDt, toDt, page);
        } else {
            txs = transactionRepository.findAllPartnerWithDetails(page);
        }

        // Filter by partnerName if specified
        if (partnerName != null && !partnerName.isBlank() && !"ALL".equalsIgnoreCase(partnerName)) {
            final String filterName = partnerName.trim().toLowerCase();
            txs = txs.stream()
                    .filter(t -> t.getPartnerName() != null && t.getPartnerName().toLowerCase().contains(filterName))
                    .toList();
        }

        BigDecimal totalGrossRevenue = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalPartnerShare = BigDecimal.ZERO;
        BigDecimal totalCpmShare = BigDecimal.ZERO;
        BigDecimal totalSettledPartnerShare = BigDecimal.ZERO;
        BigDecimal totalUnsettledPartnerShare = BigDecimal.ZERO;
        int totalUnitsSold = 0;

        Map<String, Object[]> productsMap = new LinkedHashMap<>();
        Map<String, BigDecimal> partnerTotals = new LinkedHashMap<>();
        Map<String, BigDecimal> dailyRevenue = new TreeMap<>();
        List<Map<String, Object>> salesLedger = new ArrayList<>();

        for (Transaction t : txs) {
            if ("UNPAID".equalsIgnoreCase(t.getStatus())) continue;
            BigDecimal rev = t.getFinalPrice() != null ? t.getFinalPrice() : BigDecimal.ZERO;
            BigDecimal cost = t.getCostPrice() != null ? t.getCostPrice() : BigDecimal.ZERO;
            BigDecimal grossProfit = rev.subtract(cost);

            BigDecimal pShare = t.getPartnerShare() != null ? t.getPartnerShare() : BigDecimal.ZERO;
            BigDecimal cShare = t.getCpmShare() != null ? t.getCpmShare() : BigDecimal.ZERO;

            if (pShare.compareTo(BigDecimal.ZERO) == 0 && cShare.compareTo(BigDecimal.ZERO) == 0 && grossProfit.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal split = t.getPartnerSplitPct() != null ? t.getPartnerSplitPct() : new BigDecimal("50.00");
                pShare = grossProfit.multiply(split).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
                cShare = grossProfit.subtract(pShare);
            }

            totalGrossRevenue = totalGrossRevenue.add(rev);
            totalCost = totalCost.add(cost);
            totalPartnerShare = totalPartnerShare.add(pShare);
            totalCpmShare = totalCpmShare.add(cShare);
            totalUnitsSold++;

            boolean isSettled = "PAID".equalsIgnoreCase(t.getPartnerSettlementStatus());
            if (isSettled) {
                totalSettledPartnerShare = totalSettledPartnerShare.add(pShare);
            } else {
                totalUnsettledPartnerShare = totalUnsettledPartnerShare.add(pShare);
            }

            String pName = t.getPartnerName() != null && !t.getPartnerName().isBlank() ? t.getPartnerName() : "Pickle Gear";
            partnerTotals.put(pName, partnerTotals.getOrDefault(pName, BigDecimal.ZERO).add(pShare));

            if (t.getVariant() != null) {
                String sku = t.getVariant().getSku();
                String name = (t.getVariant().getProduct() != null ? t.getVariant().getProduct().getBrandName() + " " + t.getVariant().getProduct().getModelName() : sku);
                Object[] pArr = productsMap.computeIfAbsent(sku, k -> new Object[]{name, 0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
                pArr[1] = ((int) pArr[1]) + 1;
                pArr[2] = ((BigDecimal) pArr[2]).add(rev);
                pArr[3] = ((BigDecimal) pArr[3]).add(grossProfit);
                pArr[4] = ((BigDecimal) pArr[4]).add(cShare);
                pArr[5] = ((BigDecimal) pArr[5]).add(pShare);
            }

            if (t.getTransactionDate() != null) {
                String dayKey = t.getTransactionDate().toLocalDate().toString();
                dailyRevenue.put(dayKey, dailyRevenue.getOrDefault(dayKey, BigDecimal.ZERO).add(rev));
            }

            Map<String, Object> ledgerItem = new LinkedHashMap<>();
            ledgerItem.put("id", t.getId());
            ledgerItem.put("orderId", t.getTransactionId() != null ? t.getTransactionId() : "TX-" + t.getId());
            ledgerItem.put("date", t.getTransactionDate());
            ledgerItem.put("customerName", t.getCustomerName());
            ledgerItem.put("sku", t.getVariant() != null ? t.getVariant().getSku() : "N/A");
            ledgerItem.put("productName", t.getVariant() != null && t.getVariant().getProduct() != null ? t.getVariant().getProduct().getBrandName() + " " + t.getVariant().getProduct().getModelName() : "Item");
            ledgerItem.put("finalPrice", rev);
            ledgerItem.put("costPrice", cost);
            ledgerItem.put("grossProfit", grossProfit);
            ledgerItem.put("partnerName", pName);
            ledgerItem.put("partnerSplitPct", t.getPartnerSplitPct() != null ? t.getPartnerSplitPct() : new BigDecimal("50.00"));
            ledgerItem.put("partnerShare", pShare);
            ledgerItem.put("cpmShare", cShare);
            ledgerItem.put("settlementStatus", isSettled ? "PAID" : "UNPAID");
            ledgerItem.put("paymentMethod", t.getPaymentMethod());
            salesLedger.add(ledgerItem);
        }

        List<StockBatch> partnerBatches = stockBatchRepository.findAllPartnerBatchesWithDetails();
        if (partnerName != null && !partnerName.isBlank() && !"ALL".equalsIgnoreCase(partnerName)) {
            final String filterName = partnerName.trim().toLowerCase();
            partnerBatches = partnerBatches.stream()
                    .filter(b -> b.getPartnerName() != null && b.getPartnerName().toLowerCase().contains(filterName))
                    .toList();
        }

        int activePartnerUnitsOnHand = 0;
        BigDecimal partnerStockCostOnHand = BigDecimal.ZERO;
        Map<String, Integer> onHandByProduct = new HashMap<>();

        for (StockBatch b : partnerBatches) {
            int rem = b.getRemainingQuantity() != null ? b.getRemainingQuantity() : 0;
            if (rem > 0) {
                activePartnerUnitsOnHand += rem;
                BigDecimal unitCost = b.getAcquisitionPrice() != null ? b.getAcquisitionPrice() : BigDecimal.ZERO;
                partnerStockCostOnHand = partnerStockCostOnHand.add(unitCost.multiply(BigDecimal.valueOf(rem)));
                if (b.getVariant() != null && b.getVariant().getSku() != null) {
                    onHandByProduct.merge(b.getVariant().getSku(), rem, Integer::sum);
                }
            }
        }

        BigDecimal totalGrossProfit = totalGrossRevenue.subtract(totalCost);
        BigDecimal marginPct = totalGrossRevenue.compareTo(BigDecimal.ZERO) > 0
                ? totalGrossProfit.divide(totalGrossRevenue, 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalGrossRevenue", totalGrossRevenue);
        summary.put("totalCost", totalCost);
        summary.put("totalGrossProfit", totalGrossProfit);
        summary.put("marginPct", marginPct);
        summary.put("totalPartnerShare", totalPartnerShare);
        summary.put("totalCpmShare", totalCpmShare);
        summary.put("totalSettledPartnerShare", totalSettledPartnerShare);
        summary.put("totalUnsettledPartnerShare", totalUnsettledPartnerShare);
        summary.put("unitsSold", totalUnitsSold);
        summary.put("unitsOnHand", activePartnerUnitsOnHand);
        summary.put("stockCostOnHand", partnerStockCostOnHand);

        List<Map<String, Object>> productBreakdown = productsMap.entrySet().stream()
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("sku", e.getKey());
                    m.put("name", e.getValue()[0]);
                    m.put("unitsSold", e.getValue()[1]);
                    m.put("revenue", e.getValue()[2]);
                    m.put("grossProfit", e.getValue()[3]);
                    m.put("cpmShare", e.getValue()[4]);
                    m.put("partnerShare", e.getValue()[5]);
                    m.put("unitsOnHand", onHandByProduct.getOrDefault(e.getKey(), 0));
                    return m;
                })
                .sorted((a, b) -> ((BigDecimal) b.get("revenue")).compareTo((BigDecimal) a.get("revenue")))
                .toList();

        List<Map<String, Object>> trend = dailyRevenue.entrySet().stream()
                .map(e -> Map.of("date", (Object) e.getKey(), "revenue", (Object) e.getValue()))
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("summary", summary);
        response.put("partnerTotals", partnerTotals);
        response.put("productBreakdown", productBreakdown);
        response.put("trend", trend);
        response.put("salesLedger", salesLedger);

        return ResponseEntity.ok(response);
    }

    // ─── POST /api/admin/partner-transactions/{id}/settle ──────────────────────
    @PostMapping("/partner-transactions/{id}/settle")
    public ResponseEntity<?> togglePartnerSettlement(@PathVariable Long id, @RequestParam(required = false) String status) {
        return transactionRepository.findById(id).map(t -> {
            String newStatus = (status != null && !status.isBlank())
                    ? status.toUpperCase()
                    : ("PAID".equalsIgnoreCase(t.getPartnerSettlementStatus()) ? "UNPAID" : "PAID");
            t.setPartnerSettlementStatus(newStatus);
            transactionRepository.save(t);
            return ResponseEntity.ok(Map.of(
                "id", t.getId(),
                "partnerSettlementStatus", newStatus,
                "message", "Partner settlement updated to " + newStatus
            ));
        }).orElse(ResponseEntity.notFound().build());
    }
}
