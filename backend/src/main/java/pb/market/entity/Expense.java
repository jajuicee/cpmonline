package pb.market.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "expenses")
@Data
public class Expense {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String category; // Miscellaneous, Bills, Supplies, Salary

    private BigDecimal cost;
    
    private String type = "EXPENSE"; // EXPENSE or INCOME

    public String getType() {
        return type == null ? "EXPENSE" : type;
    }

    private String note;

    private LocalDateTime expenseDate;

    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    private Branch branch;

    // Used to group expenses with specific stock batches for the "revert" feature
    @Column(name = "batch_id", length = 36)
    private String batchId;

    // Payment source/account: Cash Drawer, GCash, Maya, BDO, BPI, GoTyme, MBOS, Other
    @Column(name = "payment_source", length = 50)
    private String paymentSource = "Cash Drawer";

    public String getPaymentSource() {
        return paymentSource == null || paymentSource.isBlank() ? "Cash Drawer" : paymentSource;
    }

    @PrePersist
    protected void onCreate() {
        if (this.expenseDate == null) {
            this.expenseDate = LocalDateTime.now();
        }
    }
}
