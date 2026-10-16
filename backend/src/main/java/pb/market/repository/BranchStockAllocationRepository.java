package pb.market.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pb.market.entity.BranchStockAllocation;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface BranchStockAllocationRepository extends JpaRepository<BranchStockAllocation, Long> {

    /** All allocations for a specific branch, newest first */
    List<BranchStockAllocation> findByBranchIdOrderByAllocatedAtDesc(Long branchId);

    /** Allocations filtered by payment status */
    List<BranchStockAllocation> findByBranchIdAndStatusOrderByDeadlineAsc(Long branchId, String status);

    /** All allocations across all branches, newest first (admin overview) */
    List<BranchStockAllocation> findAllByOrderByAllocatedAtDesc();

    /** Overdue: deadline passed and not fully paid */
    @Query("SELECT a FROM BranchStockAllocation a WHERE a.deadline < :today AND a.status != 'PAID'")
    List<BranchStockAllocation> findOverdue(@Param("today") LocalDate today);

    @Query("SELECT a FROM BranchStockAllocation a WHERE a.branch.id = :branchId AND a.deadline < :today AND a.status != 'PAID'")
    List<BranchStockAllocation> findOverdueByBranch(@Param("branchId") Long branchId, @Param("today") LocalDate today);

    /** Upcoming: deadline within the next 7 days and not fully paid */
    @Query("SELECT a FROM BranchStockAllocation a WHERE a.branch.id = :branchId AND a.deadline >= :today AND a.deadline <= :cutoff AND a.status != 'PAID' ORDER BY a.deadline ASC")
    List<BranchStockAllocation> findUpcomingByBranch(@Param("branchId") Long branchId, @Param("today") LocalDate today, @Param("cutoff") LocalDate cutoff);

    /** Total amount owed by a branch (sum of totalCost) */
    @Query("SELECT COALESCE(SUM(a.totalCost), 0) FROM BranchStockAllocation a WHERE a.branch.id = :branchId")
    BigDecimal sumTotalCostByBranchId(@Param("branchId") Long branchId);

    /** Total amount paid by a branch */
    @Query("SELECT COALESCE(SUM(a.amountPaid), 0) FROM BranchStockAllocation a WHERE a.branch.id = :branchId")
    BigDecimal sumAmountPaidByBranchId(@Param("branchId") Long branchId);

    /** Outstanding balance for a branch (totalCost - amountPaid) for unpaid entries */
    @Query("SELECT COALESCE(SUM(a.totalCost - a.amountPaid), 0) FROM BranchStockAllocation a WHERE a.branch.id = :branchId AND a.status != 'PAID'")
    BigDecimal sumOutstandingByBranchId(@Param("branchId") Long branchId);

    /** Count of overdue allocations per branch for the admin overview */
    @Query("SELECT a.branch.id, COUNT(a) FROM BranchStockAllocation a WHERE a.deadline < :today AND a.status != 'PAID' GROUP BY a.branch.id")
    List<Object[]> countOverdueByBranch(@Param("today") LocalDate today);

    /** Outstanding balance per branch for the admin overview */
    @Query("SELECT a.branch.id, COALESCE(SUM(a.totalCost - a.amountPaid), 0) FROM BranchStockAllocation a WHERE a.status != 'PAID' GROUP BY a.branch.id")
    List<Object[]> sumOutstandingPerBranch();

    /** All allocations for a specific admin batch ID (for group revert) */
    List<BranchStockAllocation> findByAdminBatchId(String adminBatchId);
}
