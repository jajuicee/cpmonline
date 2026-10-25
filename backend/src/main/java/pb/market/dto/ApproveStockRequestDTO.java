package pb.market.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class ApproveStockRequestDTO {
    private LocalDate deadline;
    private String adminNotes;
    private List<ItemApproval> items;

    @Data
    public static class ItemApproval {
        private Long itemId;
        private Long variantId;
        private Integer approvedQuantity;
        private BigDecimal costPerUnit;
        private BigDecimal sellingPrice;
    }
}
