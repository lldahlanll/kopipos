import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/transactions?id=${id}`, { replace: true });
  }, [id, navigate]);

  return null;
}
