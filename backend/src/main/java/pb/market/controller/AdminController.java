package pb.market.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import pb.market.entity.Branch;
import pb.market.entity.Role;
import pb.market.entity.User;
import pb.market.repository.BranchRepository;
import pb.market.repository.StockBatchRepository;
import pb.market.repository.TransactionRepository;
import pb.market.repository.UserRepository;

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

    public AdminController(
            BranchRepository branchRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            TransactionRepository transactionRepository,
            StockBatchRepository stockBatchRepository) {
        this.branchRepository = branchRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.transactionRepository = transactionRepository;
        this.stockBatchRepository = stockBatchRepository;
    }

    // ─── BRANCH CRUD ──────────────────────────────────────────────

    @GetMapping("/branches")
    public List<Branch> getAllBranches() {
        return branchRepository.findAll();
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

    @DeleteMapping("/branches/{id}")
    public ResponseEntity<?> deleteBranch(@PathVariable Long id) {
        if (!branchRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        branchRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Branch deleted"));
    }

    @GetMapping("/branches/overview")
    public List<Map<String, Object>> getBranchesOverview() {
        java.time.LocalDateTime startOfToday = java.time.LocalDate.now().atStartOfDay();
        java.time.LocalDateTime endOfToday = startOfToday.plusDays(1);

        return branchRepository.findAll().stream().map(b -> {
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
}
