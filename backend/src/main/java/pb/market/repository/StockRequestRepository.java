package pb.market.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pb.market.entity.StockRequest;

import java.util.List;
import java.util.Optional;

public interface StockRequestRepository extends JpaRepository<StockRequest, Long> {

    List<StockRequest> findByBranchIdOrderByCreatedAtDesc(Long branchId);

    List<StockRequest> findByBranchIdAndStatusOrderByCreatedAtDesc(Long branchId, String status);

    List<StockRequest> findAllByOrderByCreatedAtDesc();

    List<StockRequest> findByStatusOrderByCreatedAtDesc(String status);

    long countByStatus(String status);

    @Query("SELECT r FROM StockRequest r LEFT JOIN FETCH r.items i LEFT JOIN FETCH i.variant v LEFT JOIN FETCH v.product WHERE r.id = :id")
    Optional<StockRequest> findByIdWithDetails(@Param("id") Long id);

    @Query("SELECT r FROM StockRequest r LEFT JOIN FETCH r.items i LEFT JOIN FETCH i.variant v LEFT JOIN FETCH v.product WHERE r.branch.id = :branchId ORDER BY r.createdAt DESC")
    List<StockRequest> findByBranchIdWithDetails(@Param("branchId") Long branchId);

    @Query("SELECT r FROM StockRequest r LEFT JOIN FETCH r.items i LEFT JOIN FETCH i.variant v LEFT JOIN FETCH v.product ORDER BY r.createdAt DESC")
    List<StockRequest> findAllWithDetails();
}
