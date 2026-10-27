package pb.market.entity;

import jakarta.persistence.*;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions")
@Data
public class Transaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // Internal DB Primary Key

    private String transactionId; // Shared ID for all items purchased in a single checkout event

    // Include variant data (sku, color, sellingPrice) + its parent product (brandName, modelName)
    // when this Transaction is serialized. 'variants' is ignored to prevent circular reference.
    @JsonIgnoreProperties({"variants", "stockQuantity"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id", nullable = false)
    private ProductVariant variant;

    private String customerName;
    private String paymentMethod; // GCash, Banko, BDO, GoTyme, Cash, Split Payment
    private String paymentDetails; // Detailed string if split payment (e.g., GCash (500) + Cash (300))
    @Column(columnDefinition = "TEXT")
    private String notes; // Purchase notes / order remarks
    private String status;        // FULL or PARTIAL
    
    private BigDecimal downpayment;
    private BigDecimal finalPrice; // The price you agreed on for this sale
    private BigDecimal costPrice;  // The exact cost of this item from FIFO stock batches
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Supplier supplier;

    private boolean consigned = false;

    private LocalDateTime transactionDate;
    
    // We store a reference to the specific batch this item was taken from,
    // so that we can accurately return it to that same batch if the order is cancelled/deleted.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_batch_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private StockBatch stockBatch;

    private String transactionType = "REGULAR"; // REGULAR or CONSIGNMENT

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "consignee_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Consignee consignee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Branch branch;

    @Transient
    private java.util.List<java.util.Map<String, Object>> splits;

    @PrePersist
    protected void onCreate() {
        this.transactionDate = LocalDateTime.now();
        if (this.downpayment == null) this.downpayment = BigDecimal.ZERO;
    }
}