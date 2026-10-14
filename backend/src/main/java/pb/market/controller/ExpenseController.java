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
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (user != null && "BRANCH".equals(user.getRole())) {
            branchId = user.getBranchId();
        }
        return expenseRepository.findAllByBranchOrderByExpenseDateDesc(branchId);
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
        if (user != null && "BRANCH".equals(user.getRole())) {
            branchId = user.getBranchId();
        } else if (expense.getBranch() != null && expense.getBranch().getId() != null) {
            branchId = expense.getBranch().getId();
        }
        if (branchId != null) {
            branchRepository.findById(branchId).ifPresent(expense::setBranch);
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
            return ResponseEntity.ok(expenseRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }
}
