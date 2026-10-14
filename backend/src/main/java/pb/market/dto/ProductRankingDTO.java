package pb.market.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductRankingDTO {
    private int rank;
    private Long variantId;
    private String productName;
    private String brandName;
    private String modelName;
    private String color;
    private String shape;
    private Integer thicknessMm;
    private String sku;
    private String category;
    private long unitsSold;
    private BigDecimal revenue;
}
