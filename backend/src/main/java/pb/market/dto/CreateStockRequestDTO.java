package pb.market.dto;

import lombok.Data;

import java.util.List;

@Data
public class CreateStockRequestDTO {
    private Long branchId;
    private String notes;
    private List<Item> items;

    @Data
    public static class Item {
        private Long variantId;
        private Integer quantity;
    }
}
