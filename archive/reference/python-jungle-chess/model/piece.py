from .rank import Rank
from .player import Player

class Position:
    row: int
    col: int

    def __init__(self,row,col):
        self.row = row
        self.col = col
        
    def __eq__(self, other):
        return isinstance(other, Position) and self.row == other.row and self.col == other.col
class Piece:
    id: int
    name: str
    rank: Rank
    owner: Player
    position: Position
    is_alive: bool = True

    def __init__(self, char, rank: Rank, owner: Player, position: Position):
        self.id = id(self)
        name = self.get_animal_name(char)
        self.name = name
        self.rank = rank
        self.owner = owner
        self.position = position
        self.symbol = owner.name[0] + name + str(self.rank.value)
    
    def remove_piece(self):
        self.is_alive = False
        self.position = None

    def get_animal_name(self, char: str) -> str:
        """
        Convert a piece character (e.g., 'L', 'E', 'R') to animal name.
        Example: 'L' -> 'Lion'
        """
        animal_map = {
            'R': 'Rat',
            'C': 'Cat',
            'D': 'Dog',
            'W': 'Wolf',
            'P': 'Leopard',
            'T': 'Tiger',
            'L': 'Lion',
            'E': 'Elephant'
        }
        
        char = char.upper()
        if char not in animal_map:
            raise ValueError(f"Unknown animal character: '{char}'")
        
        return animal_map[char]