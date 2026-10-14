package pb.market.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import pb.market.config.JwtUtil;
import pb.market.config.UserPrincipal;
import pb.market.entity.User;
import pb.market.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        if (username == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));
        }

        User user = userRepository.findByUsername(username).orElse(null);

        if (user == null || !user.isActive() || !passwordEncoder.matches(password, user.getPasswordHash())) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
        }

        // Update last login timestamp
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        Long branchId = user.getBranch() != null ? user.getBranch().getId() : null;
        String token = jwtUtil.generateToken(user.getUsername(), user.getRole().name(), branchId);

        // Use LinkedHashMap to allow null values (Map.of() does not)
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("token", token);
        resp.put("username", user.getUsername());
        resp.put("role", user.getRole().name());
        resp.put("branchId", branchId);
        resp.put("branchName", user.getBranch() != null ? user.getBranch().getName() : null);

        return ResponseEntity.ok(resp);
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        User user = userRepository.findByUsername(principal.getUsername()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("username", user.getUsername());
        resp.put("role", user.getRole().name());
        resp.put("branchId", user.getBranch() != null ? user.getBranch().getId() : null);
        resp.put("branchName", user.getBranch() != null ? user.getBranch().getName() : null);
        resp.put("active", user.isActive());

        return ResponseEntity.ok(resp);
    }
}
