package pb.market.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pb.market.entity.Partner;
import java.util.List;
import java.util.Optional;

public interface PartnerRepository extends JpaRepository<Partner, Long> {
    List<Partner> findByArchivedFalseOrderByNameAsc();
    Optional<Partner> findByNameIgnoreCase(String name);
}
