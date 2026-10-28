package pb.market.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import pb.market.entity.Branch;
import pb.market.repository.BranchRepository;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import pb.market.config.UserPrincipal;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/branches")
@RequiredArgsConstructor
@CrossOrigin
public class BranchController {

    private final BranchRepository branchRepository;

    @GetMapping
    public List<Branch> getAllBranches() {
        return branchRepository.findAll();
    }

    @PostMapping("/verify-price-password")
    public ResponseEntity<?> verifyPricePassword(
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal user) {

        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Not authenticated."));
        }

        Long branchId = null;
        if (user.getBranchId() != null) {
            branchId = user.getBranchId();
        } else if (body != null && body.containsKey("branchId") && body.get("branchId") != null) {
            try {
                branchId = Long.valueOf(body.get("branchId").toString().trim());
            } catch (NumberFormatException ignored) {}
        }

        Branch branch = null;
        if (branchId != null) {
            branch = branchRepository.findById(branchId).orElse(null);
        }
        if (branch == null) {
            branch = branchRepository.findByActiveTrue().stream().findFirst()
                    .orElseGet(() -> branchRepository.findAll().stream().findFirst().orElse(null));
        }

        if (branch == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "No active branch found."));
        }

        String enteredPassword = body != null && body.get("password") != null
                ? body.get("password").toString().trim()
                : "";

        String expectedPassword = branch.getEffectivePriceChangePassword();

        if (expectedPassword.equals(enteredPassword)) {
            return ResponseEntity.ok(Map.of(
                    "valid", true,
                    "message", "Authorization successful."
            ));
        } else {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "valid", false,
                    "error", "Incorrect password. Authorization failed."
            ));
        }
    }

    @GetMapping("/price-password")
    public ResponseEntity<?> getPricePassword(
            @RequestParam(value = "branchId", required = false) Long paramBranchId,
            @AuthenticationPrincipal UserPrincipal user) {

        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Not authenticated."));
        }

        if ("CASHIER".equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Cashiers are not permitted to view the price password."));
        }

        Long branchId = user.getBranchId() != null ? user.getBranchId() : paramBranchId;
        Branch branch = null;
        if (branchId != null) {
            branch = branchRepository.findById(branchId).orElse(null);
        }
        if (branch == null) {
            branch = branchRepository.findByActiveTrue().stream().findFirst()
                    .orElseGet(() -> branchRepository.findAll().stream().findFirst().orElse(null));
        }

        if (branch == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Branch not found."));
        }

        return ResponseEntity.ok(Map.of(
                "branchId", branch.getId(),
                "branchName", branch.getName(),
                "priceChangePassword", branch.getEffectivePriceChangePassword()
        ));
    }

    @PutMapping("/price-password")
    public ResponseEntity<?> updatePricePassword(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal user) {

        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Not authenticated."));
        }

        if ("CASHIER".equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Cashiers are not permitted to configure the price password."));
        }

        Long branchId = user.getBranchId();
        if (branchId == null && body != null && body.containsKey("branchId") && body.get("branchId") != null) {
            try {
                branchId = Long.valueOf(body.get("branchId").toString().trim());
            } catch (NumberFormatException ignored) {}
        }

        Branch branch = null;
        if (branchId != null) {
            branch = branchRepository.findById(branchId).orElse(null);
        }
        if (branch == null) {
            branch = branchRepository.findByActiveTrue().stream().findFirst()
                    .orElseGet(() -> branchRepository.findAll().stream().findFirst().orElse(null));
        }

        if (branch == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Branch not found."));
        }

        String newPassword = body != null && body.get("newPassword") != null
                ? body.get("newPassword").toString().trim()
                : null;

        if (newPassword == null || newPassword.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "New password cannot be empty."));
        }

        branch.setPriceChangePassword(newPassword);
        branchRepository.save(branch);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Cashier price change password updated successfully.",
                "branchId", branch.getId(),
                "priceChangePassword", newPassword
        ));
    }
}
