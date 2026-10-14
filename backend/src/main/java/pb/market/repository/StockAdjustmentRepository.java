package pb.market.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pb.market.entity.StockAdjustment;

import java.util.List;

public interface StockAdjustmentRepository extends JpaRepository<StockAdjustment, Long> {
    @Query("SELECT a.variant.id, a.quantity, a.adjustedAt FROM StockAdjustment a WHERE a.variant IS NOT NULL AND a.quantity IS NOT NULL")
    List<Object[]> findAllVariantIdsQuantitiesAndDates();

    @Query("SELECT a FROM StockAdjustment a JOIN FETCH a.variant v JOIN FETCH v.product")
    List<StockAdjustment> findAllWithDetails();

    List<StockAdjustment> findByVariantIdOrderByAdjustedAtDesc(Long variantId);

    // Total units removed via manual adjustments per variant (damaged, returned to supplier, etc.)
    @Query("SELECT a.variant.id, COALESCE(SUM(a.quantity), 0) FROM StockAdjustment a GROUP BY a.variant.id")
    List<Object[]> sumQuantityByVariantId();

    @Query("SELECT a.variant.id, COALESCE(SUM(a.quantity), 0) FROM StockAdjustment a " +
           "WHERE (:branchId IS NULL OR a.branch.id = :branchId) GROUP BY a.variant.id")
    List<Object[]> sumQuantityByVariantIdAndBranch(@Param("branchId") Long branchId);

    @Query("SELECT a FROM StockAdjustment a WHERE a.variant.id = :variantId " +
           "AND (:branchId IS NULL OR a.branch.id = :branchId) ORDER BY a.adjustedAt DESC")
    List<StockAdjustment> findByVariantIdAndBranchOrderByAdjustedAtDesc(@Param("variantId") Long variantId, @Param("branchId") Long branchId);
}
