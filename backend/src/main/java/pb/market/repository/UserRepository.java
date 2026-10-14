package pb.market.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pb.market.entity.User;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
}
