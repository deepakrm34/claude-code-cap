import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './index';

// Pre-typed hooks — use these everywhere instead of the raw react-redux ones.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
