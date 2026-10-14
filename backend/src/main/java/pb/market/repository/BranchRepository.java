package pb.market.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pb.market.entity.Branch;

import java.util.List;

public interface BranchRepository extends JpaRepository<Branch, Long> {
    List<Branch> findByActiveTrue();
}
