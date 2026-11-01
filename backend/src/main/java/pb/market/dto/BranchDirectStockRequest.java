package pb.market.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class BranchDirectStockRequest {
    private Long branchId;
    private Long supplierId; // REQUIRED
    private String notes;
    private List<DirectStockItem> items;

    @Data
    public static class DirectStockItem {
        private Long variantId;
        private Integer quantity;
        private BigDecimal acquisitionPrice;
        private BigDecimal sellingPrice;
    }
}

