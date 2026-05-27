class Player:
    def __init__(self, name):
        self.id = id(self)
        self.name=name
        self.pieces=[]
        self.undos=3
        self.moved_this_turn=False

    def add_piece(self, piece):
        if piece not in self.pieces:
            self.pieces.append(piece)

    def remove_piece(self, piece):
        if piece in self.pieces:
            self.pieces.remove(piece)

    def get_alive_pieces(self):
        return [piece for piece in self.pieces if piece.is_alive]
        
    def __str__(self):
        return f"Player({self.name}) with {len(self.get_alive_pieces())} active pieces"

