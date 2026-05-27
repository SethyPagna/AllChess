from .piece import Piece, Position, Rank 
from .board import Board  
from typing import Tuple, Union, Optional
from .player import Player

class GameRules:
  def __init__(self):
    pass

  def validate_move(self, piece, from_pos: Position, to_pos: Position, board):
    """Validate a piece's move according to Jungle Chess rules."""

    # 1. Base checks
    if piece is None:
      return False, "No piece selected."

    if not (0 <= to_pos.row < board.rows and 0 <= to_pos.col < board.cols):
      return False, "Move out of board boundaries."
    #i read the position....it doesn't have what i wrote...
    
    # target_piece, target_cell = board.grid[to_pos.row][to_pos.col]
    # _, from_cell = board.grid[from_pos.row][from_pos.col]

    # dest_terrain, dest_owner = target_cell if target_cell else ("land", None)
    # start_terrain, _ = from_cell if from_cell else ("land", None)
    target_piece = board.piece_at(to_pos)
    dest_terrain, dest_owner = board.cell_at(to_pos)
    start_terrain, _ = board.cell_at(from_pos)  
    
    # 2. Movement distance
    row_diff = to_pos.row - from_pos.row
    col_diff = to_pos.col - from_pos.col
    delta_row, delta_col = abs(row_diff), abs(col_diff)
    
    is_one_step = (delta_row + delta_col == 1)

    # 3. Special Jump Rule for Lion/Tiger
    # if piece.rank in [Rank.LION, Rank.TIGER]:
    if piece.rank in (Rank.LION, Rank.TIGER):
      if not (is_one_step or self._is_river_jump(from_pos, to_pos, board)):
        return False, "Lion/Tiger must move one step or jump across the river."
    else:
      if not is_one_step:
        return False, "This animal can only move one step."

    # 4. Terrain restrictions
    if not self._can_enter_cell(piece, dest_terrain, dest_owner):
      return False, f"{piece.name} cannot enter {dest_terrain}."

    # 5. Capturing rules
    if target_piece:
      if target_piece.owner == piece.owner:
        return False, "Cannot capture your own piece."

      # can_capture, reason = self._can_capture(piece, target_piece, dest_terrain)
      can_capture, reason = self._can_capture(piece, target_piece, from_pos, to_pos, board)
      if not can_capture:
        return False, reason
      return True, target_piece  # valid capture

    # 6. Valid empty move
    return True, None


  #Can enter conditions
  # def _can_enter_cell(self, piece, terrain, cell_owner):
  def _can_enter_cell(self, piece: Piece, terrain: str, cell_owner: Optional[Player]) -> bool:
    """Check whether the piece can legally enter a terrain type."""
    if terrain == "~":
       # Only Rat can enter river
      return piece.rank == Rank.RAT 
    elif terrain == "den":
      # Cannot enter own den
      return cell_owner != piece.owner
    return True  # land or trap are always allowed

  # def _can_capture(self, attacker, defender, dest_terrain):
  def _can_capture(self, attacker: Piece, defender: Piece, from_pos: Position, to_pos: Position, board: Board) -> Tuple[bool, Optional[str]]:
    """Check Jungle Chess capturing rules."""

    # 1. If defender is in own trap, attacker can always capture it
    dest_terrain, dest_owner = board.cell_at(to_pos)
    if dest_terrain == "trap" and dest_owner is attacker.owner:
      return True, None

    # 2. Elephant cannot capture Rat
    if attacker.rank == Rank.ELEPHANT and defender.rank == Rank.RAT:
      return False, "Elephant cannot capture Rat."

    # 3. Rat can capture Elephant (special exception)
    if attacker.rank == Rank.RAT and defender.rank == Rank.ELEPHANT:
      start_terrain, _ = board.cell_at(from_pos)
      # If attacker is in river and defender on land -> not allowed (and vice versa)
      if start_terrain == "~" and dest_terrain != "~":
        return False, "Rat cannot capture from river to land."
      if start_terrain != "~" and dest_terrain == "~":
        return False, "Rat cannot capture from land to river."
      return True, None

    # 4. If attacker is Rat and it's in river, cannot capture piece on land

    
    if attacker.rank == Rank.RAT:
      start_terrain, _ = board.cell_at(from_pos)
      # If attacker is in river and defender on land -> not allowed (and vice versa)
      if start_terrain == "~" and dest_terrain != "~":
        return False, "Rat cannot capture from river to land."
      if start_terrain != "~" and dest_terrain == "~":
        return False, "Rat cannot capture from land to river."
    
    # 5.  piece can capture if rank >= defender.rank
    if attacker.rank >= defender.rank:
      return True, None

    return False, "Cannot capture higher-ranked piece."


  #Lion?Tiger Jump Rules
  def _is_river_jump(self, from_pos, to_pos, board):
    """-The lion and tiger pieces may jump over a river by moving horizontally or vertically. 
    -They move from a square on one edge of the river to the next non-water square on the other side. 
    -Such a move is not allowed if there is a rat (whether friendly or enemy) on any of the intervening water squares. 
    -The lion and tiger are allowed to capture enemy pieces by such jumping moves"""
    fr, fc = from_pos.row, from_pos.col
    tr, tc = to_pos.row, to_pos.col

    # Must move in a straight line 
    if fr != tr and fc != tc:
      return False

    # Move = Direction
    row_step = 0 if fr == tr else (1 if tr > fr else -1)
    col_step = 0 if fc == tc else (1 if tc > fc else -1)

    # Move one cell at a time until reaching destination
    r, c = fr + row_step, fc + col_step
    found_river_cells = False
    while (r != tr or c != tc):
      if not (0 <= r < board.rows and 0 <= c < board.cols):
        return False
        
      _, cell = board.grid[r][c]
      terrain, _ = cell if cell else ("land", None)
      terrain, _ = board.cell_at(Position(r, c))
      if terrain != "~":
        return False
        
      found_river_cells = True
      piece_in_path = board.piece_at(Position(r, c))
      if piece_in_path and piece_in_path.rank == Rank.RAT:
          return False
        
      r += row_step
      c += col_step

    dest_terrain, _ = board.cell_at(to_pos)
    if dest_terrain == "~":
      return False

    return found_river_cells

  def get_valid_moves(self, piece, board):
    """Return all valid destination positions for the given piece."""
    
    if piece is None or not piece.is_alive:
        return []

    moves = []

    # Four directions
    directions = [
        (1, 0),
        (-1, 0),
        (0, 1),
        (0, -1),
    ]

    from_pos = piece.position

    for dr, dc in directions:
        to_row = from_pos.row + dr
        to_col = from_pos.col + dc
        to_pos = Position(to_row, to_col)

        # 1) Skip out-of-bound moves
        if not (0 <= to_row < board.rows and 0 <= to_col < board.cols):
            continue

        # 2) Lion/Tiger river jump attempt
        if piece.rank in (Rank.LION, Rank.TIGER):
            if self._is_river_jump(from_pos, to_pos, board):
                # If jump is valid
                is_valid, _ = self.validate_move(piece, from_pos, to_pos, board)
                if is_valid:
                    moves.append(to_pos)
                continue  # Don't try 1-step move for this direction

        # 3) Normal one-step move
        is_valid, _ = self.validate_move(piece, from_pos, to_pos, board)
        if is_valid:
            moves.append(to_pos)

    return moves