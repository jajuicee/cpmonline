package pb.market.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pb.market.entity.Transaction;
import java.time.LocalDateTime;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    // Eager-load variant + product + defaultSupplier in one SQL trip, newest first
    // LEFT JOIN FETCH on defaultSupplier prevents LazyInitializationException (open-in-view=false)
    @Query("SELECT t.variant.id, t.transactionDate FROM Transaction t WHERE t.variant IS NOT NULL")
    List<Object[]> findAllVariantIdsAndDates();

    @Query("SELECT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch ORDER BY t.transactionDate DESC")
    List<Transaction> findAllWithDetails(org.springframework.data.domain.Pageable pageable);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch " +
           "WHERE (:branchId IS NULL OR t.branch.id = :branchId) ORDER BY t.transactionDate DESC")
    List<Transaction> findAllWithDetailsByBranch(@Param("branchId") Long branchId, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch WHERE t.transactionType = 'CONSIGNMENT' ORDER BY t.transactionDate DESC")
    List<Transaction> findAllConsignmentWithDetails(org.springframework.data.domain.Pageable pageable);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch " +
           "WHERE t.transactionType = 'CONSIGNMENT' AND (:branchId IS NULL OR t.branch.id = :branchId) ORDER BY t.transactionDate DESC")
    List<Transaction> findAllConsignmentWithDetailsByBranch(@Param("branchId") Long branchId, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch WHERE t.transactionDate >= :from AND t.transactionDate <= :to ORDER BY t.transactionDate DESC")
    List<Transaction> findAllWithDetailsInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT DISTINCT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch " +
           "WHERE (t.transactionDate >= :from AND t.transactionDate <= :to) " +
           "OR t.transactionId IN (SELECT p.orderId FROM PaymentLog p WHERE p.paymentDate >= :from AND p.paymentDate <= :to) " +
           "OR CONCAT('LEGACY-', CAST(t.id AS string)) IN (SELECT p.orderId FROM PaymentLog p WHERE p.paymentDate >= :from AND p.paymentDate <= :to) " +
           "ORDER BY t.transactionDate DESC")
    List<Transaction> findAllWithDetailsByActivityDate(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT DISTINCT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch " +
           "WHERE ((t.transactionDate >= :from AND t.transactionDate <= :to) " +
           "OR t.transactionId IN (SELECT p.orderId FROM PaymentLog p WHERE p.paymentDate >= :from AND p.paymentDate <= :to) " +
           "OR CONCAT('LEGACY-', CAST(t.id AS string)) IN (SELECT p.orderId FROM PaymentLog p WHERE p.paymentDate >= :from AND p.paymentDate <= :to)) " +
           "AND (:branchId IS NULL OR t.branch.id = :branchId OR (t.consignee IS NOT NULL AND t.consignee.branch.id = :branchId)) " +
           "ORDER BY t.transactionDate DESC")
    List<Transaction> findAllWithDetailsByActivityDateAndBranch(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, @Param("branchId") Long branchId, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch " +
           "WHERE t.branch IS NULL ORDER BY t.transactionDate DESC")
    List<Transaction> findAllWithDetailsHq(org.springframework.data.domain.Pageable pageable);

    @Query("SELECT DISTINCT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch " +
           "WHERE ((t.transactionDate >= :from AND t.transactionDate <= :to) " +
           "OR t.transactionId IN (SELECT p.orderId FROM PaymentLog p WHERE p.paymentDate >= :from AND p.paymentDate <= :to) " +
           "OR CONCAT('LEGACY-', CAST(t.id AS string)) IN (SELECT p.orderId FROM PaymentLog p WHERE p.paymentDate >= :from AND p.paymentDate <= :to)) " +
           "AND t.branch IS NULL " +
           "ORDER BY t.transactionDate DESC")
    List<Transaction> findAllWithDetailsByActivityDateHq(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT DISTINCT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch " +
           "WHERE (t.branch IS NULL OR (t.consignee IS NOT NULL AND t.consignee.branch IS NULL)) " +
           "ORDER BY t.transactionDate DESC")
    List<Transaction> findAllMainAdminTransactions(org.springframework.data.domain.Pageable pageable);

    @Query("SELECT DISTINCT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch " +
           "WHERE (t.branch IS NULL OR (t.consignee IS NOT NULL AND t.consignee.branch IS NULL)) " +
           "AND ((t.transactionDate >= :from AND t.transactionDate <= :to) " +
           "OR t.transactionId IN (SELECT p.orderId FROM PaymentLog p WHERE p.paymentDate >= :from AND p.paymentDate <= :to) " +
           "OR CONCAT('LEGACY-', CAST(t.id AS string)) IN (SELECT p.orderId FROM PaymentLog p WHERE p.paymentDate >= :from AND p.paymentDate <= :to)) " +
           "ORDER BY t.transactionDate DESC")
    List<Transaction> findAllMainAdminTransactionsInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, org.springframework.data.domain.Pageable pageable);


    @Query("SELECT t.variant.id, COUNT(t) FROM Transaction t WHERE t.status != 'UNPAID' GROUP BY t.variant.id")
    List<Object[]> countByVariantId();

    @Query("SELECT t.variant.id, COUNT(t) FROM Transaction t WHERE t.status != 'UNPAID' " +
           "AND (:branchId IS NULL OR t.branch.id = :branchId) GROUP BY t.variant.id")
    List<Object[]> countByVariantIdAndBranch(@Param("branchId") Long branchId);

    // Lightweight aggregate for Expenses & Analytics pages — avoids downloading full entities
    @Query("SELECT COALESCE(SUM(t.finalPrice), 0) FROM Transaction t WHERE t.transactionDate >= :from AND t.transactionDate <= :to")
    java.math.BigDecimal sumFinalPriceInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT COALESCE(SUM(t.finalPrice), 0) FROM Transaction t WHERE t.transactionDate >= :from AND t.transactionDate <= :to AND (:branchId IS NULL OR t.branch.id = :branchId)")
    java.math.BigDecimal sumFinalPriceInRangeAndBranch(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, @Param("branchId") Long branchId);

    @Query("SELECT COALESCE(SUM(t.finalPrice), 0) FROM Transaction t")
    java.math.BigDecimal sumFinalPriceAll();

    @Query("SELECT COALESCE(SUM(t.finalPrice), 0) FROM Transaction t WHERE (:branchId IS NULL OR t.branch.id = :branchId)")
    java.math.BigDecimal sumFinalPriceAllByBranch(@Param("branchId") Long branchId);

    // Breakdown by payment method for Analytics page — returns [paymentMethod, sum]
    @Query("SELECT t.paymentMethod, COALESCE(SUM(t.finalPrice), 0) FROM Transaction t WHERE t.transactionDate >= :from AND t.transactionDate <= :to GROUP BY t.paymentMethod")
    List<Object[]> sumFinalPriceByPaymentMethodInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT t.paymentMethod, COALESCE(SUM(t.finalPrice), 0) FROM Transaction t WHERE t.transactionDate >= :from AND t.transactionDate <= :to AND (:branchId IS NULL OR t.branch.id = :branchId) GROUP BY t.paymentMethod")
    List<Object[]> sumFinalPriceByPaymentMethodInRangeAndBranch(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, @Param("branchId") Long branchId);

    @Query("SELECT t.paymentMethod, COALESCE(SUM(t.finalPrice), 0) FROM Transaction t GROUP BY t.paymentMethod")
    List<Object[]> sumFinalPriceByPaymentMethodAll();

    @Query("SELECT t.paymentMethod, COALESCE(SUM(t.finalPrice), 0) FROM Transaction t WHERE (:branchId IS NULL OR t.branch.id = :branchId) GROUP BY t.paymentMethod")
    List<Object[]> sumFinalPriceByPaymentMethodAllByBranch(@Param("branchId") Long branchId);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch WHERE t.transactionId = :transactionId")
    List<Transaction> findByTransactionId(@Param("transactionId") String transactionId);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.branch WHERE t.id = :id")
    java.util.Optional<Transaction> findByIdWithDetails(@Param("id") Long id);

    @Query("SELECT t.supplier.id, COUNT(t) FROM Transaction t " +
           "WHERE t.consigned = true AND t.status != 'UNPAID' " +
           "AND t.transactionDate >= :start AND t.transactionDate <= :end " +
           "GROUP BY t.supplier.id")
    List<Object[]> countSoldConsignedBySupplierInRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    List<Transaction> findBySupplierId(Long supplierId);

    List<Transaction> findByVariantId(Long variantId);

    boolean existsByVariantId(Long variantId);

    List<Transaction> findByStockBatchIn(List<pb.market.entity.StockBatch> batches);

    // ── Batch sales lookups ──────────────────────────────────────────────────
    @Query("SELECT t FROM Transaction t LEFT JOIN FETCH t.consignee LEFT JOIN FETCH t.variant v LEFT JOIN FETCH v.product WHERE t.stockBatch IN :batches ORDER BY t.transactionDate DESC")
    List<Transaction> findByStockBatchInWithConsignee(@Param("batches") List<pb.market.entity.StockBatch> batches);

    // ── Category Sales Analytics ─────────────────────────────────────────────
    @Query("SELECT p.category, COUNT(t), COALESCE(SUM(t.finalPrice), 0) " +
           "FROM Transaction t JOIN t.variant v JOIN v.product p " +
           "WHERE t.status != 'UNPAID' " +
           "AND (:branchId IS NULL OR t.branch.id = :branchId) " +
           "GROUP BY p.category")
    List<Object[]> findCategorySalesAllTime(@Param("branchId") Long branchId);

    @Query("SELECT p.category, COUNT(t), COALESCE(SUM(t.finalPrice), 0) " +
           "FROM Transaction t JOIN t.variant v JOIN v.product p " +
           "WHERE t.status != 'UNPAID' " +
           "AND t.transactionDate >= :from AND t.transactionDate <= :to " +
           "AND (:branchId IS NULL OR t.branch.id = :branchId) " +
           "GROUP BY p.category")
    List<Object[]> findCategorySalesInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, @Param("branchId") Long branchId);

    // ── Variant Sales Analytics ──────────────────────────────────────────────
    @Query("SELECT t.variant.id, COUNT(t), COALESCE(SUM(t.finalPrice), 0) " +
           "FROM Transaction t " +
           "WHERE t.status != 'UNPAID' " +
           "AND (:branchId IS NULL OR t.branch.id = :branchId) " +
           "GROUP BY t.variant.id")
    List<Object[]> findVariantSalesAllTime(@Param("branchId") Long branchId);

    @Query("SELECT t.variant.id, COUNT(t), COALESCE(SUM(t.finalPrice), 0) " +
           "FROM Transaction t " +
           "WHERE t.status != 'UNPAID' " +
           "AND t.transactionDate >= :from AND t.transactionDate <= :to " +
           "AND (:branchId IS NULL OR t.branch.id = :branchId) " +
           "GROUP BY t.variant.id")
    List<Object[]> findVariantSalesInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, @Param("branchId") Long branchId);

    // ── Top Ranking Units ────────────────────────────────────────────────────
    @Query("SELECT v.id, p.brandName, p.modelName, v.color, v.shape, v.thicknessMm, v.sku, p.category, " +
           "COUNT(t), COALESCE(SUM(t.finalPrice), 0) " +
           "FROM Transaction t JOIN t.variant v JOIN v.product p " +
           "WHERE t.status != 'UNPAID' " +
           "AND (:branchId IS NULL OR t.branch.id = :branchId) " +
           "GROUP BY v.id, p.brandName, p.modelName, v.color, v.shape, v.thicknessMm, v.sku, p.category " +
           "ORDER BY COUNT(t) DESC, COALESCE(SUM(t.finalPrice), 0) DESC")
    List<Object[]> findTopRankingUnitsAllTime(@Param("branchId") Long branchId, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT v.id, p.brandName, p.modelName, v.color, v.shape, v.thicknessMm, v.sku, p.category, " +
           "COUNT(t), COALESCE(SUM(t.finalPrice), 0) " +
           "FROM Transaction t JOIN t.variant v JOIN v.product p " +
           "WHERE t.status != 'UNPAID' " +
           "AND t.transactionDate >= :from AND t.transactionDate <= :to " +
           "AND (:branchId IS NULL OR t.branch.id = :branchId) " +
           "GROUP BY v.id, p.brandName, p.modelName, v.color, v.shape, v.thicknessMm, v.sku, p.category " +
           "ORDER BY COUNT(t) DESC, COALESCE(SUM(t.finalPrice), 0) DESC")
    List<Object[]> findTopRankingUnitsInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, @Param("branchId") Long branchId, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT COALESCE(SUM(t.finalPrice - COALESCE(t.downpayment, 0)), 0) FROM Transaction t WHERE t.transactionType = 'CONSIGNMENT' AND t.status != 'FULL'")
    java.math.BigDecimal sumConsigneePayables();

    @Query("SELECT COALESCE(SUM(t.finalPrice - COALESCE(t.downpayment, 0)), 0) FROM Transaction t WHERE (t.transactionType IS NULL OR t.transactionType != 'CONSIGNMENT') AND t.status != 'FULL'")
    java.math.BigDecimal sumCustomerUnpaid();

    // ── Partner Queries ──────────────────────────────────────────────────────
    @Query("SELECT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.branch " +
           "WHERE t.partner = true ORDER BY t.transactionDate DESC")
    List<Transaction> findAllPartnerWithDetails(org.springframework.data.domain.Pageable pageable);

    @Query("SELECT t FROM Transaction t JOIN FETCH t.variant v JOIN FETCH v.product LEFT JOIN FETCH v.defaultSupplier LEFT JOIN FETCH t.supplier LEFT JOIN FETCH t.stockBatch LEFT JOIN FETCH t.branch " +
           "WHERE t.partner = true AND t.transactionDate >= :from AND t.transactionDate <= :to ORDER BY t.transactionDate DESC")
    List<Transaction> findAllPartnerWithDetailsInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, org.springframework.data.domain.Pageable pageable);
}
