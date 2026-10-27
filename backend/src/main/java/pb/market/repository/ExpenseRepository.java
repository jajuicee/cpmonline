package pb.market.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pb.market.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    List<Expense> findAllByOrderByExpenseDateDesc();
    List<Expense> findByBatchId(String batchId);

    @Query("SELECT e FROM Expense e WHERE e.branch.id = :branchId ORDER BY e.expenseDate DESC")
    List<Expense> findAllByBranchIdOrderByExpenseDateDesc(@Param("branchId") Long branchId);

    @Query("SELECT e FROM Expense e WHERE e.branch IS NULL ORDER BY e.expenseDate DESC")
    List<Expense> findAllAdminExpensesOrderByExpenseDateDesc();

    @Query("SELECT e FROM Expense e WHERE e.expenseDate >= :from AND e.expenseDate <= :to ORDER BY e.expenseDate DESC")
    List<Expense> findByDateRange(
            @Param("from") java.time.LocalDateTime from,
            @Param("to") java.time.LocalDateTime to);

    @Query("SELECT e FROM Expense e WHERE e.branch.id = :branchId AND e.expenseDate >= :from AND e.expenseDate <= :to ORDER BY e.expenseDate DESC")
    List<Expense> findByDateRangeAndBranch(
            @Param("from") java.time.LocalDateTime from,
            @Param("to") java.time.LocalDateTime to,
            @Param("branchId") Long branchId);

    @Query("SELECT e FROM Expense e WHERE e.branch IS NULL AND e.expenseDate >= :from AND e.expenseDate <= :to ORDER BY e.expenseDate DESC")
    List<Expense> findAdminExpensesByDateRange(
            @Param("from") java.time.LocalDateTime from,
            @Param("to") java.time.LocalDateTime to);

    @Query("SELECT e.paymentSource, COALESCE(SUM(e.cost), 0) FROM Expense e WHERE e.type = 'EXPENSE' GROUP BY e.paymentSource")
    List<Object[]> sumExpensesByPaymentSourceAll();

    @Query("SELECT e.paymentSource, COALESCE(SUM(e.cost), 0) FROM Expense e WHERE e.type = 'EXPENSE' AND e.branch.id = :branchId GROUP BY e.paymentSource")
    List<Object[]> sumExpensesByPaymentSourceByBranch(@Param("branchId") Long branchId);

    @Query("SELECT COALESCE(SUM(e.cost), 0) FROM Expense e WHERE e.type = 'EXPENSE' AND e.branch.id = :branchId")
    java.math.BigDecimal sumExpensesByBranch(@Param("branchId") Long branchId);

    @Query("SELECT COALESCE(SUM(e.cost), 0) FROM Expense e WHERE e.type = 'EXPENSE' AND e.branch IS NULL")
    java.math.BigDecimal sumAdminExpenses();

    @Query("SELECT e.branch.id, COALESCE(SUM(e.cost), 0) FROM Expense e WHERE e.type = 'EXPENSE' AND (e.paymentSource IS NULL OR LOWER(e.paymentSource) LIKE '%cash%') AND e.branch IS NOT NULL GROUP BY e.branch.id")
    List<Object[]> sumCashExpensesByBranchAll();

    @Query("SELECT e.branch.id, COALESCE(SUM(e.cost), 0) FROM Expense e WHERE e.type = 'EXPENSE' AND (e.paymentSource IS NULL OR LOWER(e.paymentSource) LIKE '%cash%') AND e.expenseDate >= :from AND e.expenseDate <= :to AND e.branch IS NOT NULL GROUP BY e.branch.id")
    List<Object[]> sumCashExpensesByBranchInRange(@Param("from") java.time.LocalDateTime from, @Param("to") java.time.LocalDateTime to);

    @Query("SELECT COALESCE(SUM(e.cost), 0) FROM Expense e WHERE e.type = 'EXPENSE' AND (e.paymentSource IS NULL OR LOWER(e.paymentSource) LIKE '%cash%') AND e.branch IS NULL")
    java.math.BigDecimal sumAdminCashExpensesAll();

    @Query("SELECT COALESCE(SUM(e.cost), 0) FROM Expense e WHERE e.type = 'EXPENSE' AND (e.paymentSource IS NULL OR LOWER(e.paymentSource) LIKE '%cash%') AND e.expenseDate >= :from AND e.expenseDate <= :to AND e.branch IS NULL")
    java.math.BigDecimal sumAdminCashExpensesInRange(@Param("from") java.time.LocalDateTime from, @Param("to") java.time.LocalDateTime to);

    @Query("SELECT e FROM Expense e LEFT JOIN FETCH e.branch ORDER BY e.expenseDate DESC")
    List<Expense> findTopMovements(org.springframework.data.domain.Pageable pageable);

    @Query("SELECT e FROM Expense e LEFT JOIN FETCH e.branch WHERE e.branch.id = :branchId ORDER BY e.expenseDate DESC")
    List<Expense> findTopMovementsByBranch(@Param("branchId") Long branchId, org.springframework.data.domain.Pageable pageable);
}
