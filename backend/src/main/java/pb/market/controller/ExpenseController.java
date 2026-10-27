package pb.market.controller;

import pb.market.entity.Expense;
import pb.market.repository.ExpenseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class ExpenseController {
    private final ExpenseRepository expenseRepository;
    private final pb.market.repository.BranchRepository branchRepository;

    @GetMapping
    public List<Expense> getAll(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            branchId = user.getBranchId();
        }

        java.time.LocalDateTime fromDt = null;
        java.time.LocalDateTime toDt = null;
        if (from != null && !from.isBlank()) {
            try { fromDt = java.time.LocalDateTime.parse(from); } catch (Exception ignored) {}
        }
        if (to != null && !to.isBlank()) {
            try { toDt = java.time.LocalDateTime.parse(to); } catch (Exception ignored) {}
        }

        // Specific filter for Admin-only expenses (no branch assigned)
        if (branchId != null && (branchId == 0L || branchId == -1L)) {
            if (fromDt != null || toDt != null) {
                java.time.LocalDateTime f = fromDt != null ? fromDt : java.time.LocalDateTime.of(2020, 1, 1, 0, 0);
                java.time.LocalDateTime t = toDt != null ? toDt : java.time.LocalDateTime.now();
                return expenseRepository.findAdminExpensesByDateRange(f, t);
            }
            return expenseRepository.findAllAdminExpensesOrderByExpenseDateDesc();
        }

        if (fromDt != null || toDt != null) {
            java.time.LocalDateTime f = fromDt != null ? fromDt : java.time.LocalDateTime.of(2020, 1, 1, 0, 0);
            java.time.LocalDateTime t = toDt != null ? toDt : java.time.LocalDateTime.now();
            return branchId == null
                    ? expenseRepository.findByDateRange(f, t)
                    : expenseRepository.findByDateRangeAndBranch(f, t, branchId);
        }

        return branchId == null
                ? expenseRepository.findAllByOrderByExpenseDateDesc()
                : expenseRepository.findAllByBranchIdOrderByExpenseDateDesc(branchId);
    }

    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody Expense expense,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (expense.getName() == null || expense.getName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Expense name is required."));
        }
        if (expense.getCost() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cost is required."));
        }

        Long branchId = null;
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            branchId = user.getBranchId();
        } else if (expense.getBranch() != null && expense.getBranch().getId() != null && expense.getBranch().getId() > 0) {
            branchId = expense.getBranch().getId();
        }

        if (branchId != null) {
            branchRepository.findById(branchId).ifPresent(expense::setBranch);
        } else {
            expense.setBranch(null);
        }

        if (expense.getPaymentSource() == null || expense.getPaymentSource().isBlank()) {
            expense.setPaymentSource("Cash Drawer");
        }

        Expense saved = expenseRepository.save(expense);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") Long id) {
        if (!expenseRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        expenseRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Expense deleted."));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable("id") Long id, @RequestBody Expense expense) {
        return expenseRepository.findById(id).map(existing -> {
            if (expense.getName() != null) existing.setName(expense.getName());
            if (expense.getCategory() != null) existing.setCategory(expense.getCategory());
            if (expense.getCost() != null) existing.setCost(expense.getCost());
            if (expense.getNote() != null) existing.setNote(expense.getNote());
            if (expense.getType() != null) existing.setType(expense.getType());
            if (expense.getPaymentSource() != null) existing.setPaymentSource(expense.getPaymentSource());
            if (expense.getBranch() != null) {
                if (expense.getBranch().getId() != null && expense.getBranch().getId() > 0) {
                    branchRepository.findById(expense.getBranch().getId()).ifPresent(existing::setBranch);
                } else {
                    existing.setBranch(null);
                }
            }
            return ResponseEntity.ok(expenseRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }
}
