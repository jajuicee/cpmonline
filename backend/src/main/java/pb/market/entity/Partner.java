package pb.market.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "partners")
@Data
public class Partner {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    private String contactInfo;

    @Column(name = "default_split_pct", precision = 5, scale = 2)
    private BigDecimal defaultSplitPct = new BigDecimal("50.00");

    private String notes;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean archived = false;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (defaultSplitPct == null) {
            defaultSplitPct = new BigDecimal("50.00");
        }
    }
}
