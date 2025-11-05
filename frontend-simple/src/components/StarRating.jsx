// src/components/StarRating.jsx
import { useState } from 'react'
import '../App.css' // Dùng CSS chung

function StarRating({ rating, onRatingChange }) {
  // 'rating' là số sao đã chọn (click)
  // 'hover' là số sao đang di chuột qua
  const [hover, setHover] = useState(0);

  return (
    <div className="star-rating">
      {[...Array(5)].map((_, index) => {
        const ratingValue = index + 1; // 1, 2, 3, 4, 5

        return (
          <span
            key={ratingValue}
            // Nếu ratingValue nhỏ hơn (hover || rating) thì tô vàng
            className={ratingValue <= (hover || rating) ? 'star-filled' : 'star-empty'}
            onClick={() => onRatingChange(ratingValue)}
            onMouseEnter={() => setHover(ratingValue)}
            onMouseLeave={() => setHover(0)}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}

export default StarRating;