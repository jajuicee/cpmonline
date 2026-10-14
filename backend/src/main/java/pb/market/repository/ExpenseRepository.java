package pb.market.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pb.market.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    List<Expense> findAllByOrderByExpenseDateDesc();
    List<Expense> findByBatchId(String batchId);

    @Query("SELECT e FROM Expense e WHERE (:branchId IS NULL OR e.branch.id = :branchId) ORDER BY e.expenseDate DESC")
    List<Expense> findAllByBranchOrderByExpenseDateDesc(@Param("branchId") Long branchId);
}
