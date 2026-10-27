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
}
