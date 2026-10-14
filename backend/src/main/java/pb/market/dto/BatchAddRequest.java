package pb.market.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class BatchAddRequest {
    private Long supplierId;
    private boolean consigned;
    private String status;
    private java.time.LocalDate eta;
    private BigDecimal totalExpense;
    private Long branchId;
    private List<BatchItem> items;

    @Data
    public static class BatchItem {
        private Long variantId;
        private Integer quantity;
        private BigDecimal baseCost; // Cost before shipping
        private Boolean consigned;
    }
}
