package pb.market.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import pb.market.entity.Branch;
import pb.market.entity.Role;
import pb.market.entity.User;
import pb.market.repository.BranchRepository;
import pb.market.repository.UserRepository;

/**
 * Seeds a default admin account and initial branch on first run.
 * Credentials:
 *   Admin: admin / admin123
 *   Branch: branch_cebu / branch123
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final BranchRepository branchRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository, BranchRepository branchRepository,
                      PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.branchRepository = branchRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        Branch mainBranch = null;
        if (branchRepository.count() == 0) {
            Branch b = new Branch();
            b.setName("Bayabas Branch");
            b.setAddress("Cebu City");
            b.setContactInfo("0917-123-4567");
            mainBranch = branchRepository.save(b);
            System.out.println("Default retail branch 'Bayabas Branch' created.");
        } else {
            mainBranch = branchRepository.findAll().stream().filter(Branch::isActive).findFirst().orElse(null);
        }

        if (userRepository.count() == 0) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPasswordHash(passwordEncoder.encode("admin123"));
            admin.setRole(Role.ADMIN);
            userRepository.save(admin);

            if (mainBranch != null) {
                User branchUser = new User();
                branchUser.setUsername("branch_cebu");
                branchUser.setPasswordHash(passwordEncoder.encode("branch123"));
                branchUser.setRole(Role.BRANCH);
                branchUser.setBranch(mainBranch);
                userRepository.save(branchUser);
            }

            System.out.println("============================================");
            System.out.println("  DEFAULT USERS SEEDED:");
            System.out.println("  1. ADMIN:  admin / admin123");
            System.out.println("  2. BRANCH: branch_cebu / branch123");
            System.out.println("  *** Change credentials after first login! ***");
            System.out.println("============================================");
        }
    }
}
