SELECT status_pagamento, status_pedido, COUNT(*) FROM pedidos GROUP BY status_pagamento, status_pedido
