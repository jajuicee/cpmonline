package pb.market.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pb.market.entity.Consignee;
import java.util.List;

public interface ConsigneeRepository extends JpaRepository<Consignee, Long> {
    @Query("SELECT c FROM Consignee c LEFT JOIN FETCH c.branch WHERE (:branchId IS NULL OR c.branch.id = :branchId) ORDER BY c.name ASC")
    List<Consignee> findAllByBranch(@Param("branchId") Long branchId);

    @Query("SELECT c FROM Consignee c LEFT JOIN FETCH c.branch WHERE " +
           "(:includeArchived = true OR c.archived = false) AND (" +
           "(:onlyHq = true AND c.branch IS NULL) OR " +
           "(:onlyHq = false AND (:branchId IS NULL OR c.branch.id = :branchId))" +
           ") ORDER BY c.name ASC")
    List<Consignee> findAllByBranchOrHq(
            @Param("branchId") Long branchId,
            @Param("onlyHq") boolean onlyHq,
            @Param("includeArchived") boolean includeArchived);
}
