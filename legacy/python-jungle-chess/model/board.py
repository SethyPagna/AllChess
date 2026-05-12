class Board:
    """
    A game board that manages pieces and cells on a grid.
    
    The board maintains a grid where each position contains a tuple of
    (piece, cell). Pieces represent game pieces that can move around the board,
    while cells represent static board features with names and owners.
    
    Attributes:
        rows (int): Number of rows in the board (default: 9)
        cols (int): Number of columns in the board (default: 7)
        grid (list): 2D list representing the board state, where each element
                    is a tuple (piece, cell)
    """
    
    def __init__(self, piece_list, cell_list):
        """
        Initialize the board with pieces and cells.
        
        Args:
            piece_list (list): List of tuples in format (row, col, piece_object)
                            representing initial piece placements
            cell_list (list): List of tuples in format (row, col, (cell_name, owner))
                            representing board cells and their properties
        """
        self.rows = 9
        self.cols = 7
        # Create grid where each position is a tuple (piece, cell)
        self.grid = [[(None, None) for _ in range(self.cols)] for _ in range(self.rows)]
        #self.move_history = []
        self.setup_board(piece_list, cell_list)
        
    def setup_board(self, piece_list, cell_list):
        """
        Set up the initial board state with pieces and cells.
        
        First clears the board, then places pieces while preserving existing cells,
        then places cells while preserving existing pieces.
        
        Args:
            piece_list (list): List of tuples (row, col, piece_object)
            cell_list (list): List of tuples (row, col, (cell_name, owner))
        """
        # Initialize all positions with (None, None)
        for row in range(self.rows):
            for col in range(self.cols):
                self.grid[row][col] = (None, None)
        
        # Set pieces
        for row, col, piece in piece_list:
            current_cell = self.grid[row][col][1]  # Preserve existing cell
            self.grid[row][col] = (piece, current_cell)
        
        # Set cells
        for row, col, cell in cell_list:
            current_piece = self.grid[row][col][0]  # Preserve existing piece
            self.grid[row][col] = (current_piece, cell)

    def place(self, piece, pos):
        """
        Place a piece at the specified position.
        
        Used for placing dead pieces or during undo operations. Overwrites
        any existing piece at the position while preserving the cell.
        
        Args:
            piece: The piece object to place
            pos: Position object with row and col attributes
        """
        # place dead piece for undo
        cell = self.grid[pos.row][pos.col][1]
        self.grid[pos.row][pos.col] = (piece, cell)
        piece.position = pos

    def remove_piece_at(self, pos):
        """
        Remove the piece at the specified position.
        
        Args:
            pos: Position object with row and col attributes
            
        Returns:
            The removed piece object, or None if no piece was present
        """
        piece, cell = self.grid[pos.row][pos.col]

        if piece is not None:
            self.grid[pos.row][pos.col] = (None, cell)
        return piece

    def move_piece(self, piece, to_pos):
        """
        Move a piece to a new position without validation.
        
        Moves the piece from its current position to the target position.
        If the piece is None or has no current position, does nothing.
        
        Args:
            piece: The piece object to move
            to_pos: Target position object with row and col attributes
        """
        #just move the cell without validation
        if piece is None:
            return 
        from_pos = piece.position
        if from_pos is None:
            return
        
        from_pos_piece, from_pos_cell = self.grid[from_pos.row][from_pos.col]
        to_pos_piece, to_pos_cell = self.grid[to_pos.row][to_pos.col]

        self.grid[from_pos.row][from_pos.col] = (None, from_pos_cell)
        self.grid[to_pos.row][to_pos.col] = (piece, to_pos_cell)
        piece.position = to_pos

    def piece_at(self, pos):
        """
        Get the piece at the specified position.
        
        Args:
            pos: Position object with row and col attributes
            
        Returns:
            The piece object at the position, or None if no piece is present
        """
        return self.grid[pos.row][pos.col][0]
    
    def cell_at(self, pos):
        """
        Get the cell at the specified position.
        
        Args:
            pos: Position object with row and col attributes
            
        Returns:
            The cell object at the position, or None if no cell is defined
        """
        return self.grid[pos.row][pos.col][1]