package pb.market.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "branches")
@Data
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Branch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String name;

    private String address;
    private String contactInfo;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "price_change_password")
    private String priceChangePassword = "admin123";

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.priceChangePassword == null || this.priceChangePassword.trim().isEmpty()) {
            this.priceChangePassword = "admin123";
        }
    }

    public String getEffectivePriceChangePassword() {
        return (this.priceChangePassword != null && !this.priceChangePassword.trim().isEmpty())
                ? this.priceChangePassword.trim()
                : "admin123";
    }
}
