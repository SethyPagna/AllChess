from .board import Board
from .player import Player
from .piece import Piece, Position
from .game_rules import GameRules
from view.userinterface import UserInterface
from .save_game import SaveGame
from typing import Tuple
from .rank import Rank
import copy

def convert_indices_to_coordinate(row, col):
    """
    Convert (row, col) indices back to coordinate like 'a1', 'g9', etc.
    Grid: left to right abcdefg, top to bottom 987654321
    Example: row 8, col 0 = 'a1'
    """
    if not (0 <= row <= 8 and 0 <= col <= 6):
        raise ValueError("Row must be 0-8, col must be 0-6")
    
    # Convert column index to letter (0=a, 1=b, 2=c, 3=d, 4=e, 5=f, 6=g)
    letter = chr(ord('a') + col)
    
    # Convert row index to number
    # Top row is row index 0 = 9, bottom row is row index 8 = 1
    # So: 0->9, 1->8, 2->7, 3->6, 4->5, 5->4, 6->3, 7->2, 8->1
    number = 9 - row
    
    return f"{letter}{number}"


RANK_MAP = {
    'R': Rank.RAT,
    'C': Rank.CAT,
    'D': Rank.DOG,
    'W': Rank.WOLF,
    'P': Rank.LEOPARD,
    'T': Rank.TIGER,
    'L': Rank.LION,
    'E': Rank.ELEPHANT
}

#E = Elephant, W = wolf, p = leopard, r = rat,
#c = cat, d = dog
#t = tiger l = lion
PIECE_MAP = [
    "L.....T",
    ".D...C.",
    "R.P.W.E",
    ".......",
    ".......",
    ".......",
    "E.W.P.R",
    ".C...D.",
    "T.....L",
]
# . = land, t = trap, d = den, r = river
CELL_MAP = [
    "..tdt..",
    "...t...",
    ".......",
    ".rr.rr.",
    ".rr.rr.",
    ".rr.rr.",
    ".......",
    "...t...",
    "..tdt..",
]

class Game:
    board: Board
    rules: GameRules
    players: Tuple[Player, Player] #(playerid1, playerid2)
    whose_turn: int #0: player1 1: player2
    move_stack: dict # (piece, from, to)
    move_history: list[str] #record in human readable string

    def __init__(self, player1, player2):
        self.players = [player1, player2]
        pieces = self.initialize_piece()
        cells = self.initialize_cell()
        self.board = Board(pieces, cells)
        self.rules = GameRules()
        self.whose_turn = 0
        self.move_stack = []
        self.move_history = []
        self.recording = False
        self.completed = False

    
    def initialize_piece(self):
        """
        Initialize piece based on PIECE_MAP.
        Each piece is given:
            - symbol
            - rank
            - owner (player0 for top pieces, player1 for bottom pieces)
            - position
        """
        ret = []
        for i, line in enumerate(PIECE_MAP):
            for j,chr in enumerate(line):
                if chr =='.':
                    continue
                rank = RANK_MAP[chr]
                owner = self.players[0] if i < 3 else self.players[1]
                pos = Position(i,j)
                piece = Piece(chr,rank,owner,pos)
                ret.append((i,j,piece))
                
        # Add pieces to Player piece lists
        for i,j,piece in ret:
            if piece.owner == self.players[0]:
                self.players[0].add_piece(piece)
            else: self.players[1].add_piece(piece)

        return ret
    
    def initialize_cell(self):
        """
        Initialize cell based on CELL_MAP.
        . = land
        t = trap
        d = den
        r = river
        Cell should be in the form of (terrain name, owner)
        """
        ret = []
        for i,line in enumerate(CELL_MAP):
            for j,chr in enumerate(line):
                if chr =='.':
                    cell = ("land",None)
                if chr == 't':
                    owner = self.players[0] if i < 3 else self.players[1]
                    cell = ("trap",owner)
                elif chr == 'd':
                    owner = self.players[0] if i < 3 else self.players[1]
                    cell = ("den",owner)
                elif chr == 'r':
                    cell = ("~",None)
                ret.append((i,j,cell))
        return ret
    
    # def initial_board_setup(self):
    #     self.board.setup_board(self.initialize_piece(), self.initialize_cell())

    def move_piece(self, from_pos, to_pos):
        """
        move piece
            1. Get moving piece
            2. Validate move via GameRules
            3. Store undo information
            4. Handle capture if needed
            5. Move piece on board
            6. Switch Turn
            7. Record move
        """
        mover = self.board.piece_at(from_pos)
        
        if mover is None:
            return False, "No piece at source."
        if mover.owner.moved_this_turn:
            return False, "You have already moved this turn. End your turn to switch players."
        if mover.owner is not self.players[self.whose_turn]: #check whether mover's turn
            return False, "Not your turn."

        # (bool, capturedPiece | errorMsg)
        # if is_valid == true: result = captured_piece, else result = msg
        is_valid, result = self.rules.validate_move(mover, from_pos, to_pos, self.board) #no valid move
        if not is_valid:
            return False,result
        # store move information for undoing
        undo_object = {
            "piece": mover,
            "from_pos": copy.deepcopy(from_pos),
            "to_pos": copy.deepcopy(to_pos),
            "captured_piece": result,
            "prev_turn": self.whose_turn
        }
        self.move_stack.append(undo_object) #record move for undo
        result2 = result
        
        # remove captured piece from board
        # result = captured_piece
        if result is not None:
            result.is_alive = False
            self.board.remove_piece_at(to_pos)
            result.owner.remove_piece(result)
            
        # Move piece on board
        self.board.move_piece(mover, to_pos)

        # Add to history
        if not self.recording:
            self.record_move(mover.name, from_pos.row, from_pos.col, to_pos.row, to_pos.col, result2)
        self.players[self.whose_turn].moved_this_turn = True
        return True,"Move successful."

    def record_move(self,piece_id,from_posx, from_posy, to_posx, to_posy, captured_piece):
        """
        Store readable move:
            - piece id
            - origin position
            - destination coordinate
            - captured piece name
        """
        captured_piece_name = "None"
        origin = convert_indices_to_coordinate(from_posx, from_posy)
        destination = convert_indices_to_coordinate(to_posx, to_posy)
        if captured_piece:
            captured_piece_name = captured_piece.name
        self.move_history.append((piece_id,origin, destination ,captured_piece_name))

    def undo_move(self): 
        """
        Undo moves from stack.
        """
        
        #undo move from top of the stack

        if not self.move_stack:
            return False, "You just started the game."
        
        move = self.move_stack.pop()

        mover = move["piece"]
        from_pos = move["from_pos"]
        to_pos = move["to_pos"]
        captured_piece = move["captured_piece"]
        prev_turn = move["prev_turn"]

        # Remove piece from destination
        self.board.remove_piece_at(to_pos)

        # Put mover back to original position
        self.board.place(mover, from_pos)
        mover.position = from_pos

        # Restore captured piece
        if captured_piece is not None:
            captured_piece.is_alive = True
            captured_piece.position = to_pos
            self.board.place(captured_piece, to_pos)
            captured_piece.owner.add_piece(captured_piece)

        self.whose_turn = prev_turn 
        self.players[self.whose_turn].moved_this_turn = False
        if self.move_history:
            self.move_history.pop()  # Remove last move from history
        
        return True,"Move undone."

    def switch_turn(self):
        """
        Switch current player. False moved_this_turn flag.
        """
        self.players[self.whose_turn].moved_this_turn = False
        self.whose_turn = 1-self.whose_turn


    def get_owner_idx(self, owner):
        """
        Return player's index = 0 or 1.
        """
        return 0 if owner is self.players[0] else 1

    def has_alive_pieces(self, owner_idx):
        """
        Return True if the player has any alive pieces.
        """
        
        player = self.players[owner_idx]
        
        return len(player.get_alive_pieces()) > 0
    
    def check_victory(self,mover,to_pos):
        """
        Victory if
        1. Enter opponent's den
        2. Opponent has no alive pieces
        
        Returns (True, winnerIndex) or (False, None)
        """
        
        # return (bool,winner). winner = None if bool = False
        cell = self.board.grid[to_pos.row][to_pos.col][1]
        mover_idx = self.get_owner_idx(mover)

        if cell[0] == "den":
            den_owner_idx = 0 if cell[1] == self.players[0] else 1
            if den_owner_idx != mover_idx:
                return True, mover_idx
        if not self.has_alive_pieces(1-mover_idx):
            return True, mover_idx
        
        return False, None
    
    def check_victory_condition(self):
        if not self.has_alive_pieces(0):
            return True
        if not self.has_alive_pieces(1):
            return True
        return False


    def save_game(self):
        SaveGame.save_game(self)

    def load_game(self):
        SaveGame.load_game(self)

            
