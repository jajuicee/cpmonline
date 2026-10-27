package pb.market.config;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Lightweight principal attached to the SecurityContext after JWT validation.
 * Available via @AuthenticationPrincipal in any controller method.
 */
@Data
@AllArgsConstructor
public class UserPrincipal {
    private String username;
    private String role;     // "ADMIN", "BRANCH", or "CASHIER"
    private Long branchId;   // null for ADMIN
}
