package pb.market.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pb.market.entity.BranchSellingPrice;
import java.util.List;
import java.util.Optional;

public interface BranchSellingPriceRepository extends JpaRepository<BranchSellingPrice, Long> {

    /** Get a branch's custom price for one variant */
    Optional<BranchSellingPrice> findByBranchIdAndVariantId(Long branchId, Long variantId);

    /** Get all price overrides for a branch */
    List<BranchSellingPrice> findAllByBranchId(Long branchId);

    /** Check if a branch has any price override for a variant */
    boolean existsByBranchIdAndVariantId(Long branchId, Long variantId);

    /** Get all overrides as [variantId, sellingPrice] pairs for a branch — for fast map building */
    @Query("SELECT bsp.variant.id, bsp.sellingPrice FROM BranchSellingPrice bsp WHERE bsp.branch.id = :branchId")
    List<Object[]> findVariantIdAndPriceByBranchId(@Param("branchId") Long branchId);
}
