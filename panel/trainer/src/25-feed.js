  // ---- feeding value ---------------------------------------------------
  // Slither's food is not uniformly valuable. A line of small pellets at the
  // edge of the current path is usually a better farm than one isolated large
  // pellet behind the player, and a corpse cluster is better still. The world
  // collector has already applied size/corpse weight; this pass adds a local
  // density term without turning feeding into an O(n^2) scan.
  function enrichFoodDensity(foods) {
    if (!foods || foods.length < 2) return foods;
    var cell = TUNE.FOOD_CLUSTER_RADIUS;
    var cell2 = cell * cell;
    var buckets = {};
    var i;
    for (i = 0; i < foods.length; i++) {
      var f = foods[i];
      var cx = Math.floor(f.x / cell);
      var cy = Math.floor(f.y / cell);
      var key = cx + ':' + cy;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(f);
    }
    for (i = 0; i < foods.length; i++) {
      var food = foods[i];
      var bx = Math.floor(food.x / cell);
      var by = Math.floor(food.y / cell);
      var count = 0;
      var mass = 0;
      for (var ox = -1; ox <= 1; ox++) {
        for (var oy = -1; oy <= 1; oy++) {
          var bucket = buckets[(bx + ox) + ':' + (by + oy)];
          if (!bucket) continue;
          for (var j = 0; j < bucket.length; j++) {
            var other = bucket[j];
            if (other === food) continue;
            if (dist2(food.x, food.y, other.x, other.y) > cell2) continue;
            count++;
            mass += other.sz;
          }
        }
      }
      food.density = count;
      food.clusterMass = mass;
      var densityBonus = Math.min(
        2.5,
        count * TUNE.FOOD_CLUSTER_BONUS + Math.min(1, mass / 140) * 0.30
      );
      food.w *= 1 + densityBonus;
    }
    return foods;
  }
