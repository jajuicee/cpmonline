package pb.market.repository;

import pb.market.entity.PaymentLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface PaymentLogRepository extends JpaRepository<PaymentLog, Long> {

    List<PaymentLog> findByOrderId(String orderId);

    @Query("SELECT pl FROM PaymentLog pl WHERE pl.paymentDate BETWEEN :from AND :to ORDER BY pl.paymentDate DESC")
    List<PaymentLog> findByPaymentDateBetween(LocalDateTime from, LocalDateTime to);

    @Query("SELECT pl FROM PaymentLog pl LEFT JOIN pl.transaction t WHERE pl.paymentDate BETWEEN :from AND :to AND (:branchId IS NULL OR t.branch.id = :branchId) ORDER BY pl.paymentDate DESC")
    List<PaymentLog> findByPaymentDateBetweenAndBranch(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, @Param("branchId") Long branchId);

    void deleteByOrderId(String orderId);

    @Query("SELECT pl FROM PaymentLog pl ORDER BY pl.paymentDate DESC")
    List<PaymentLog> findAllOrdered();

    @Query("SELECT pl FROM PaymentLog pl LEFT JOIN pl.transaction t WHERE (:branchId IS NULL OR t.branch.id = :branchId) ORDER BY pl.paymentDate DESC")
    List<PaymentLog> findAllOrderedByBranch(@Param("branchId") Long branchId);

    // Check if backfill has already been done (to avoid duplicate logs)
    boolean existsByOrderId(String orderId);

    // Lightweight aggregates for Expenses/Analytics/Financials — avoids downloading full entities
    @Query("SELECT COALESCE(SUM(pl.amount), 0) FROM PaymentLog pl WHERE pl.paymentDate >= :from AND pl.paymentDate <= :to")
    java.math.BigDecimal sumAmountInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT COALESCE(SUM(pl.amount), 0) FROM PaymentLog pl")
    java.math.BigDecimal sumAmountAll();

    // Returns [paymentMethod, sum] for payment method breakdown
    @Query("SELECT pl.paymentMethod, COALESCE(SUM(pl.amount), 0) FROM PaymentLog pl WHERE pl.paymentDate >= :from AND pl.paymentDate <= :to GROUP BY pl.paymentMethod")
    List<Object[]> sumAmountByMethodInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT pl.paymentMethod, COALESCE(SUM(pl.amount), 0) FROM PaymentLog pl GROUP BY pl.paymentMethod")
    List<Object[]> sumAmountByMethodAll();
}
